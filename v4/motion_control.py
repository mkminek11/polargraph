"""
Pure motion/geometry logic for the polargraph: one Arduino drives both
stepper motors over a single serial (COM) port, and understands one command:

    MOVE <leftDelta> <rightDelta>   -> step each motor by this many steps
                                        (relative to wherever it currently is)

The Pi converts a target (x, y) into each motor's required cord length,
compares that to what it *was* a moment ago, and sends only the difference
as a step delta. Deltas (not absolute targets) are what this sends, because
opening a serial connection resets most Arduino boards (DTR toggles reset)
-- an absolute-position protocol would then need the Arduino to remember a
step count across that reset, and getting that resync wrong is exactly what
made a 10mm jog take over a minute (it tried to travel the *entire* cord
length from a false zero). A relative delta needs no memory on the Arduino
side at all: a reset there just means "start counting from here," and the
next MOVE is still the correct small distance.

The real tradeoff: if a MOVE is ever dropped or garbled in transit, this
module's tracked position (state.position) and the gondola's actual
physical position permanently disagree by that amount, with nothing to
self-correct it except re-homing. Accepted here in exchange for jogs
actually being quick -- there's no ACK/flow-control on the wire yet to
detect a dropped command either way.

This module has no serial/GPIO code of its own: app.py injects a
send_steps(left_delta_steps, right_delta_steps) callback via configure()
that does the actual serial write. That's what let this be tested
standalone, without a real Pi or Arduino, before ever touching hardware.
"""

import math

# Coordinate frame: origin (0, 0) is the TOP-LEFT corner of the drawing
# area -- the point you manually move the carriage to during calibration.
# +x runs right, +y runs down. The drawing area is 480mm wide and 420mm
# tall from that corner (48cm right, 42cm down).
CANVAS_WIDTH_MM = 480
CANVAS_HEIGHT_MM = 420

# Motor pulley positions in the same frame. The motors sit ABOVE and
# OUTSIDE the drawing area (negative y = above the 0,0 line), which is what
# keeps the geometry well-behaved -- if a motor were exactly at the (0,0)
# corner its cord length there would be ~0 and the kinematics would blow up
# right in the corner.
#
# !!! THESE ARE A PLACEHOLDER until real measurements are taken !!!
# MOTOR_SPACING_MM  = horizontal distance between the two motor pulleys.
# MOTOR_HEIGHT_MM   = how far the pulleys sit ABOVE the 0,0 top edge.
# The pair is centered horizontally over the drawing area. Measure your
# actual build and update these two numbers for accurate drawing; jogging
# and calibration work regardless, but (x, y) drawing accuracy depends on
# them being right.
MOTOR_SPACING_MM = 600.0
MOTOR_HEIGHT_MM = 100.0

_motor_center_x = CANVAS_WIDTH_MM / 2
MOTOR_LEFT = (_motor_center_x - MOTOR_SPACING_MM / 2, -MOTOR_HEIGHT_MM)
MOTOR_RIGHT = (_motor_center_x + MOTOR_SPACING_MM / 2, -MOTOR_HEIGHT_MM)

# Center of the drawing area -- where the smiley is drawn and where the
# jog "home" dot sends the carriage.
HOME_POSITION = (CANVAS_WIDTH_MM / 2, CANVAS_HEIGHT_MM / 2)

# 28BYJ-48 in half-step mode (the 8-step ULN2003 sequence the Arduino
# firmware uses): ~4096 steps per output-shaft revolution (5.625deg stride
# over the ~64:1 gearbox -- the standard cited approximation; the exact
# ratio is 63.68395:1 if more precision is ever needed).
STEPS_PER_REV = 4096

# Cord winds directly around a 20mm-diameter drum (not a belt pulley) --
# circumference = pi * diameter.
DRUM_DIAMETER_MM = 20
DRUM_CIRCUMFERENCE_MM = math.pi * DRUM_DIAMETER_MM

STEPS_PER_MM = STEPS_PER_REV / DRUM_CIRCUMFERENCE_MM  # ~65.19


def _distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _clamp(value, low, high):
    return max(low, min(high, value))


class MotionError(Exception):
    pass


class MotorState:
    def __init__(self):
        self.position = HOME_POSITION
        self.left_length_mm = _distance(MOTOR_LEFT, HOME_POSITION)
        self.right_length_mm = _distance(MOTOR_RIGHT, HOME_POSITION)


state = MotorState()
_send_steps_fn = None


def configure(send_steps_fn):
    """send_steps_fn(left_delta_steps: int, right_delta_steps: int) -> (ok: bool, error: str|None)"""
    global _send_steps_fn
    _send_steps_fn = send_steps_fn


def move_to(x, y):
    """The only motion primitive: drive both cords so the gondola reaches
    an absolute (x, y) in mm. Everything else (jog, home, smiley) calls this.
    Only the *change* in each cord length is sent to the Arduino as a step
    delta -- state.position is still tracked here as the Pi's source of
    truth for where the gondola should be."""
    if _send_steps_fn is None:
        raise MotionError("Motion not configured")

    x = _clamp(float(x), 0, CANVAS_WIDTH_MM)
    y = _clamp(float(y), 0, CANVAS_HEIGHT_MM)
    target = (x, y)

    target_left_length = _distance(MOTOR_LEFT, target)
    target_right_length = _distance(MOTOR_RIGHT, target)
    delta_left_steps = round((target_left_length - state.left_length_mm) * STEPS_PER_MM)
    delta_right_steps = round((target_right_length - state.right_length_mm) * STEPS_PER_MM)

    ok, error = _send_steps_fn(delta_left_steps, delta_right_steps)
    if not ok:
        raise MotionError(error)

    state.left_length_mm = target_left_length
    state.right_length_mm = target_right_length
    state.position = target
    return {"x": x, "y": y}


def jog(dx, dy):
    return move_to(state.position[0] + dx, state.position[1] + dy)


def home():
    return move_to(*HOME_POSITION)


def set_origin(x=0.0, y=0.0):
    """Declares the carriage is physically AT (x, y) right now -- without
    sending any motion -- and recomputes the reference cord lengths from
    the motor positions. This is what the calibration sequence calls at the
    end: after you've manually placed the carriage at the top-left corner
    and tensioned both cords, this pins the Pi's tracked position to (0, 0)
    so every later move is measured from a known-true origin."""
    state.position = (float(x), float(y))
    state.left_length_mm = _distance(MOTOR_LEFT, state.position)
    state.right_length_mm = _distance(MOTOR_RIGHT, state.position)
    return {"x": state.position[0], "y": state.position[1]}


# ---------------------------------------------------------------------------
# Smiley face -- fixed test pattern, deliberately simple (big smooth curves,
# generous point spacing) since fine detail is wasted on a machine that
# isn't precise enough for it.
# ---------------------------------------------------------------------------


def _circle_points(cx, cy, r, segments=48):
    return [
        (cx + r * math.cos(2 * math.pi * i / segments), cy + r * math.sin(2 * math.pi * i / segments))
        for i in range(segments + 1)
    ]


def _arc_points(cx, cy, r, start_deg, end_deg, segments=24):
    points = []
    for i in range(segments + 1):
        t = start_deg + (end_deg - start_deg) * i / segments
        rad = math.radians(t)
        points.append((cx + r * math.cos(rad), cy + r * math.sin(rad)))
    return points


def generate_smiley_path():
    """Returns an ordered list of (x, y) mm waypoints: face, left eye, right
    eye, mouth, each connected in sequence (the pen never lifts, so the
    moves between shapes are just more line -- same as everywhere else)."""
    cx, cy = HOME_POSITION
    face = _circle_points(cx, cy, 150)
    left_eye = _circle_points(cx - 60, cy - 50, 15)
    right_eye = _circle_points(cx + 60, cy - 50, 15)
    mouth = _arc_points(cx, cy + 20, 90, 20, 160)  # bottom arc of a circle = a smile, in a y-down space
    return face + left_eye + right_eye + mouth
