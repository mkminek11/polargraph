
import threading
import time
import serial.tools.list_ports

from flask import Flask, jsonify, render_template, request
from flask_sse import sse
from serial_control import State, _reader_loop, _send_steps, serial_lock, motion_lock, busy, _log, log, _run_locked, SMILEY_POINT_DELAY_SECONDS

import motion_control
from motion_control import Polargraph

app = Flask(__name__, static_folder=".", static_url_path="")
app.config["REDIS_URL"] = "redis://localhost"
app.register_blueprint(sse, url_prefix='/stream')

def update(x: float, y: float) -> None:
    sse.publish({
        "x": x,
        "y": y,
        "connected": State.connection is not None and State.connection.is_open,
        "port": State.port,
        "baudrate": State.baudrate,
        "busy": busy["value"]
    }, type='status')
    _log(f"Position updated: x={x:.2f}, y={y:.2f}")

pg = Polargraph()
pg.configure(_send_steps, update)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/ports")
def list_ports():
    ports = serial.tools.list_ports.comports()
    return jsonify([{"device": p.device, "description": p.description} for p in ports])


@app.route("/api/status")
def status():
    with serial_lock:
        connected = State.connection is not None and State.connection.is_open
        return jsonify(
            {
                "connected": connected,
                "port": State.port,
                "baudrate": State.baudrate,
                "busy": busy["value"],
            }
        )


@app.route("/api/position")
def position():
    x, y = pg.position
    return jsonify({"x": x, "y": y})


@app.route("/api/connect", methods=["POST"])
def connect():
    data = request.get_json(force=True) or {}
    port = data.get("port")
    baudrate = int(data.get("baudrate", 115200))
    if not port:
        return jsonify({"ok": False, "error": "No port specified"}), 400

    with serial_lock:
        if State.connection is not None:
            try:
                State.connection.close()
            except Exception:
                pass
            State.connection = None

        try:
            ser = serial.Serial(port, baudrate, timeout=1)
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

        State.connection = ser
        State.port = port
        State.baudrate = baudrate

    threading.Thread(target=_reader_loop, args=(ser,), daemon=True).start()
    _log(f"Connected to {port} @ {baudrate}")
    return jsonify({"ok": True})


@app.route("/api/disconnect", methods=["POST"])
def disconnect():
    with serial_lock:
        if State.connection is not None:
            try:
                State.connection.close()
            except Exception:
                pass
            State.connection = None
            State.port = None
    _log("Disconnected")
    return jsonify({"ok": True})


@app.route("/api/jog", methods=["POST"])
def jog():
    data = request.get_json(force=True) or {}
    dx, dy = float(data.get("dx", 0)), float(data.get("dy", 0))
    ok, result = _run_locked(pg.jog, dx, dy)
    if not ok:
        return jsonify({"ok": False, "error": result}), 409 if result == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


@app.route("/api/move", methods=["POST"])
def move():
    data = request.get_json(force=True) or {}
    x, y = data.get("x"), data.get("y")
    if x is None or y is None:
        return jsonify({"ok": False, "error": "x and y required"}), 400
    ok, result = _run_locked(pg.move_to, x, y)
    if not ok:
        return jsonify({"ok": False, "error": result}), 409 if result == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


@app.route("/api/home", methods=["POST"])
def home():
    ok, result = _run_locked(pg.home)
    if not ok:
        return jsonify({"ok": False, "error": result}), 409 if result == "Machine is busy" else 400
    return jsonify({"ok": True, "position": result})


def _draw_smiley_worker():
    try:
        _log("Drawing smiley...")
        for x, y in motion_control.generate_smiley_path():
            pg.move_to(x, y)
            time.sleep(SMILEY_POINT_DELAY_SECONDS)
        _log("Smiley complete")
    except motion_control.MotionError as e:
        _log(f"Smiley aborted: {e}")
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
