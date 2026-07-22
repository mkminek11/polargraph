"""
Flask backend for the polargraph: ONE Arduino drives both stepper motors
over a single serial (COM) port. Every move sends both motors' absolute
step targets in one line:

    GOTO <leftSteps> <rightSteps>

See motion_control.py for how a target (x, y) becomes those two step
counts, and for why they're absolute targets rather than relative deltas.
"""

import threading
import time
from typing import Any, Callable

from serial import Serial
import motion_control as motion

SMILEY_POINT_DELAY_SECONDS = 0.05  # pacing between queued moves; replace with a real ACK handshake once firmware exists
MAX_LOG_LINES = 200

serial_lock = threading.Lock()
motion_lock = threading.Lock()

busy = {"value": False}
log_update_fn: Callable[[], None] | None = None
log = []

class State:
    connection: Serial | None = None
    port: str | None = None
    baudrate: int = 115200


def _log(text: str) -> None:
    log.append({"text": text, "time": time.time()})

    if len(log) > MAX_LOG_LINES: del log[: len(log) - MAX_LOG_LINES]
    if log_update_fn is not None: log_update_fn()

def _reader_loop(ser: Serial) -> None:
    """ Background thread: streams anything the Arduino sends back into the log. """

    while True:
        with serial_lock:
            if State.connection is not ser: return
        
        try:
            line = ser.readline()
        except Exception:
            return
        
        if not line: return
        text = line.decode("utf-8", errors="replace").strip()
        if not text: return
        
        _log(f"recv: {text}")


def _send_steps(left_steps: int, right_steps: int) -> tuple[bool, str]:
    with serial_lock:
        ser = State.connection

        if ser is None or not ser.is_open:
            return False, "Not connected"

        try:
            ser.write(f"GOTO {left_steps} {right_steps}\n".encode("utf-8"))
        except Exception as e:
            return False, str(e)
    
    _log(f"GOTO {left_steps} {right_steps}")
    return True, ""


def _run_locked(fn: Callable[..., Any], *args) -> tuple[bool, Any | str | None]:
    if not motion_lock.acquire(blocking=False):
        return False, "Machine is busy"

    try:
        busy["value"] = True
        result = fn(*args)
        return True, result
    except motion.MotionError as e:
        return False, str(e)
    finally:
        busy["value"] = False
        motion_lock.release()

