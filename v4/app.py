"""
Flask backend for the polargraph: ONE Arduino drives both stepper motors
over a single serial (COM) port. Every move sends both motors' step deltas
in one line:

    MOVE <leftDeltaSteps> <rightDeltaSteps>

See motion_control.py for how a target (x, y) becomes those two deltas,
and why deltas are sent instead of absolute step targets.
"""

import threading
import time

import serial
import serial.tools.list_ports
from flask import Flask, jsonify, request, send_from_directory

import motion_control as motion

app = Flask(__name__, static_folder=".", static_url_path="")

MAX_LOG_LINES = 200
SMILEY_POINT_DELAY_SECONDS = 0.05  # pacing between queued moves; replace with a real ACK handshake once firmware exists

# Opening a serial port resets most Arduino boards (DTR toggles reset),
# which takes a couple seconds to reboot and print "READY". Anything sent
# before that is lost, so hold the machine "busy" for a grace period after
# connecting rather than let a jog race the reboot.
ARDUINO_BOOT_DELAY_SECONDS = 2.5

serial_lock = threading.Lock()
motion_lock = threading.Lock()
busy = {"value": False}
log = []

state = {"connection": None, "port": None, "baudrate": 115200}

# Per-motor calibration mode: "stop" | "unwind" (pay out cord) | "wind"
# (take up cord). A background worker reads these and streams MOVE chunks.
calib = {"active": False, "left": "stop", "right": "stop"}


def _append_log(text):
    log.append({"text": text, "time": time.time()})
    if len(log) > MAX_LOG_LINES:
        del log[: len(log) - MAX_LOG_LINES]


def _reader_loop(ser):
    """Background thread: streams anything the Arduino sends back into the log."""
    while True:
        with serial_lock:
            if state["connection"] is not ser:
                return
        try:
            line = ser.readline()
        except Exception:
            return
        if line:
            text = line.decode("utf-8", errors="replace").strip()
            if text:
                _append_log(f"recv: {text}")


def _send_steps(delta_left_steps, delta_right_steps):
    with serial_lock:
        ser = state["connection"]
        if ser is None or not ser.is_open:
            return False, "Not connected"
        try:
            ser.write(f"MOVE {delta_left_steps} {delta_right_steps}\n".encode("utf-8"))
        except Exception as e:
            return False, str(e)
    _append_log(f"MOVE {delta_left_steps} {delta_right_steps}")
    return True, None


def _send_run(left_sign, right_sign):
    """Sends one continuous-run command. Signs: +1 pay cord out, -1 reel in,
    0 stop. The Arduino keeps running until the next RUN, so calibration
    sends exactly one command per button press -- no streaming, no flooding."""
    with serial_lock:
        ser = state["connection"]
        if ser is None or not ser.is_open:
            return False, "Not connected"
        try:
            ser.write(f"RUN {left_sign} {right_sign}\n".encode("utf-8"))
        except Exception as e:
            return False, str(e)
    _append_log(f"RUN {left_sign} {right_sign}")
    return True, None


motion.configure(_send_steps)


def _wait_out_boot():
    """Holds motion_lock for the Arduino's post-connect reboot window so a
    jog/move can't sneak in and get silently dropped while it's still booting."""
    if not motion_lock.acquire(blocking=True, timeout=ARDUINO_BOOT_DELAY_SECONDS + 5):
        return
    try:
        busy["value"] = True
        time.sleep(ARDUINO_BOOT_DELAY_SECONDS)
    finally:
        busy["value"] = False
        motion_lock.release()


def _run_locked(fn, *args):
    if not motion_lock.acquire(blocking=False):
        return False, "Machine is busy", None
    try:
        busy["value"] = True
        result = fn(*args)
        return True, None, result
    except motion.MotionError as e:
        return False, str(e), None
    finally:
        busy["value"] = False
        motion_lock.release()


def _calib_sign(mode):
    if mode == "unwind":
        return 1   # pay cord out (lengthen)
    if mode == "wind":
        return -1  # take cord up (shorten)
    return 0


def _push_calib_run():
    """Sends a single RUN reflecting the current per-motor calibration state.
    The Arduino keeps running the motors continuously until the next RUN."""
    return _send_run(_calib_sign(calib["left"]), _calib_sign(calib["right"]))


def _end_calibration():
    """Stops both motors, clears calibration state, and releases the machine
    lock. Safe to call more than once / from any thread."""
    calib["active"] = False
    calib["left"] = "stop"
    calib["right"] = "stop"
    _send_run(0, 0)  # halt the motors (no-op if already disconnected)
    busy["value"] = False
    try:
        motion_lock.release()
    except RuntimeError:
        pass  # lock wasn't held (already ended)


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/ports")
def list_ports():
    ports = serial.tools.list_ports.comports()
    return jsonify([{"device": p.device, "description": p.description} for p in ports])


@app.route("/api/status")
def status():
    with serial_lock:
        connected = state["connection"] is not None and state["connection"].is_open
        return jsonify(
            {
                "connected": connected,
                "port": state["port"],
                "baudrate": state["baudrate"],
                "busy": busy["value"],
                "calibrating": calib["active"],
                "calib": {"left": calib["left"], "right": calib["right"]},
            }
        )


@app.route("/api/position")
def position():
    x, y = motion.state.position
    return jsonify({"x": x, "y": y})


@app.route("/api/connect", methods=["POST"])
def connect():
    data = request.get_json(force=True) or {}
    port = data.get("port")
    baudrate = int(data.get("baudrate", 115200))
    if not port:
        return jsonify({"ok": False, "error": "No port specified"}), 400

    with serial_lock:
        if state["connection"] is not None:
            try:
                state["connection"].close()
            except Exception:
                pass
            state["connection"] = None

        try:
            ser = serial.Serial(port, baudrate, timeout=1)
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

        state["connection"] = ser
        state["port"] = port
        state["baudrate"] = baudrate

    threading.Thread(target=_reader_loop, args=(ser,), daemon=True).start()
    _append_log(f"Connected to {port} @ {baudrate}")
    threading.Thread(target=_wait_out_boot, daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/disconnect", methods=["POST"])
def disconnect():
    if calib["active"]:
        _end_calibration()  # don't leave the machine lock held / stuck busy
    with serial_lock:
        if state["connection"] is not None:
            try:
                state["connection"].close()
            except Exception:
                pass
            state["connection"] = None
            state["port"] = None
    _append_log("Disconnected")
    return jsonify({"ok": True})


@app.route("/api/jog", methods=["POST"])
def jog():
    data = request.get_json(force=True) or {}
    dx, dy = float(data.get("dx", 0)), float(data.get("dy", 0))
    ok, error, result = _run_locked(motion.jog, dx, dy)
    if not ok:
        return jsonify({"ok": False, "error": error}), 409 if error == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


@app.route("/api/move", methods=["POST"])
def move():
    data = request.get_json(force=True) or {}
    x, y = data.get("x"), data.get("y")
    if x is None or y is None:
        return jsonify({"ok": False, "error": "x and y required"}), 400
    ok, error, result = _run_locked(motion.move_to, x, y)
    if not ok:
        return jsonify({"ok": False, "error": error}), 409 if error == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


@app.route("/api/home", methods=["POST"])
def home():
    ok, error, result = _run_locked(motion.home)
    if not ok:
        return jsonify({"ok": False, "error": error}), 409 if error == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


@app.route("/api/motor-step", methods=["POST"])
def motor_step():
    """Raw single-motor diagnostic: steps ONE motor by a signed step count,
    other motor untouched, bypassing all geometry. Used to see which way
    each motor physically turns so the Arduino's LEFT_INVERT / RIGHT_INVERT /
    SWAP_MOTORS flags can be set correctly. Deliberately does NOT update the
    tracked position -- it's a wiring test, not a coordinate move, so run it
    before calibrating (calibration then establishes the real origin)."""
    data = request.get_json(force=True) or {}
    motor = data.get("motor")
    try:
        steps = int(data.get("steps", 0))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "steps must be an integer"}), 400
    if motor not in ("left", "right"):
        return jsonify({"ok": False, "error": "motor must be 'left' or 'right'"}), 400

    if not motion_lock.acquire(blocking=False):
        return jsonify({"ok": False, "error": "Machine is busy"}), 409
    try:
        busy["value"] = True
        dl = steps if motor == "left" else 0
        dr = steps if motor == "right" else 0
        ok, error = _send_steps(dl, dr)
        if not ok:
            return jsonify({"ok": False, "error": error}), 400
        return jsonify({"ok": True})
    finally:
        busy["value"] = False
        motion_lock.release()


# --- Calibration -----------------------------------------------------------
# Flow: start (both motors begin unwinding) -> user stops each when its cord
# is fully paid out -> user manually moves the carriage to the 0,0 corner ->
# user winds each motor a little to tension the cords and hold the carriage
# there -> set-origin pins this as (0, 0). Holds the machine lock the whole
# time so jog/move/draw are rejected until calibration finishes.


@app.route("/api/calibrate/start", methods=["POST"])
def calibrate_start():
    with serial_lock:
        connected = state["connection"] is not None and state["connection"].is_open
    if not connected:
        return jsonify({"ok": False, "error": "Not connected"}), 400
    if not motion_lock.acquire(blocking=False):
        return jsonify({"ok": False, "error": "Machine is busy"}), 409
    busy["value"] = True
    calib["active"] = True
    calib["left"] = "unwind"
    calib["right"] = "unwind"
    _append_log("Calibration started -- both motors unwinding")
    _push_calib_run()
    return jsonify({"ok": True, "calib": {"left": calib["left"], "right": calib["right"]}})


@app.route("/api/calibrate/motor", methods=["POST"])
def calibrate_motor():
    if not calib["active"]:
        return jsonify({"ok": False, "error": "Not calibrating"}), 400
    data = request.get_json(force=True) or {}
    motor = data.get("motor")
    action = data.get("action")
    if motor not in ("left", "right") or action not in ("unwind", "wind", "stop"):
        return jsonify({"ok": False, "error": "motor=left|right, action=unwind|wind|stop"}), 400
    calib[motor] = action
    _append_log(f"Calibrate {motor}: {action}")
    ok, error = _push_calib_run()
    if not ok:
        return jsonify({"ok": False, "error": error}), 400
    return jsonify({"ok": True, "calib": {"left": calib["left"], "right": calib["right"]}})


@app.route("/api/calibrate/set-origin", methods=["POST"])
def calibrate_set_origin():
    if not calib["active"]:
        return jsonify({"ok": False, "error": "Not calibrating"}), 400
    calib["active"] = False
    calib["left"] = "stop"
    calib["right"] = "stop"
    _send_run(0, 0)  # halt both motors
    result = motion.set_origin(0.0, 0.0)
    busy["value"] = False
    try:
        motion_lock.release()
    except RuntimeError:
        pass
    _append_log("Origin set to (0, 0) -- calibration complete")
    return jsonify({"ok": True, "position": result})


@app.route("/api/calibrate/cancel", methods=["POST"])
def calibrate_cancel():
    if not calib["active"]:
        return jsonify({"ok": False, "error": "Not calibrating"}), 400
    _end_calibration()
    _append_log("Calibration cancelled")
    return jsonify({"ok": True})


def _draw_smiley_worker():
    try:
        _append_log("Drawing smiley...")
        for x, y in motion.generate_smiley_path():
            motion.move_to(x, y)
            time.sleep(SMILEY_POINT_DELAY_SECONDS)
        _append_log("Smiley complete")
    except motion.MotionError as e:
        _append_log(f"Smiley aborted: {e}")
    finally:
        busy["value"] = False
        motion_lock.release()


@app.route("/api/draw-smiley", methods=["POST"])
def draw_smiley():
    if not motion_lock.acquire(blocking=False):
        return jsonify({"ok": False, "error": "Machine is busy"}), 409
    busy["value"] = True
    threading.Thread(target=_draw_smiley_worker, daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/log")
def get_log():
    return jsonify(log[-100:])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
