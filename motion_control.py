"""
Pure motion/geometry logic for the two-Arduino polargraph: each Arduino
drives exactly one stepper motor (left or right), each over its own serial
(COM) port, and understands a single command:

    GOTO <n>   -> move this motor's shaft to absolute step position n,
                  counted from 0 = fully retracted cord (0mm)

Only the Pi knows about (x, y) at all. It converts a target position into
each motor's required cord length, then into that motor's absolute step
count, and sends GOTO to each Arduino independently. Sending an absolute
target (not a relative delta) means a single dropped/garbled command can't
compound into drift -- the next GOTO still names the exact position wanted.

This module has no serial/GPIO code of its own: app.py injects a
send_steps(left_steps, right_steps) callback via configure() that does the
actual writes to the two ports. That's what let this be tested standalone,
without a real Pi or Arduino, before ever touching hardware.
"""

import math
from typing import Callable

Coords = tuple[float, float]



class Polargraph:
    CANVAS_WIDTH_MM = 600
    CANVAS_HEIGHT_MM = 800
    MOTOR_LEFT = (0.0, 0.0)
    MOTOR_RIGHT = (float(CANVAS_WIDTH_MM), 0.0)
    HOME_POSITION = (CANVAS_WIDTH_MM / 2, CANVAS_HEIGHT_MM / 2)

    STEPS_PER_REV = 4096

    DRUM_DIAMETER_MM = 20
    DRUM_CIRCUMFERENCE_MM = math.pi * DRUM_DIAMETER_MM

    STEPS_PER_MM = STEPS_PER_REV / DRUM_CIRCUMFERENCE_MM  # ~65.19

    def __init__(self):
        self.position = self.HOME_POSITION
        self.left_length_mm = _distance(self.MOTOR_LEFT, self.HOME_POSITION)
        self.right_length_mm = _distance(self.MOTOR_RIGHT, self.HOME_POSITION)
        self._send_steps_fn: Callable[[int, int], tuple[bool, str | None]] | None = None

    def configure(self, send_steps_fn: Callable[[int, int], tuple[bool, str | None]]) -> None:
        """ send_steps_fn(left_absolute_steps: int, right_absolute_steps: int) -> (ok: bool, error: str|None) """
        self._send_steps_fn = send_steps_fn

    def move_to(self, x: float, y: float) -> Coords:
        """ The only motion primitive: drive both cords so the gondola reaches
        an absolute (x, y) in mm. Everything else (jog, home, smiley) calls this. """

        if self._send_steps_fn is None:
            raise MotionError("Motion not configured")

        x = _clamp(float(x), 0, self.CANVAS_WIDTH_MM)
        y = _clamp(float(y), 0, self.CANVAS_HEIGHT_MM)
        target = (x, y)

        target_left_length = _distance(self.MOTOR_LEFT, target)
        target_right_length = _distance(self.MOTOR_RIGHT, target)
        left_steps = round(target_left_length * self.STEPS_PER_MM)
        right_steps = round(target_right_length * self.STEPS_PER_MM)

        ok, error = self._send_steps_fn(left_steps, right_steps)
        if not ok: raise MotionError(error)

        self.left_length_mm = target_left_length
        self.right_length_mm = target_right_length
        self.position = target
        return (x, y)

    def jog(self, dx: float, dy: float) -> Coords:
        return self.move_to(self.position[0] + dx, self.position[1] + dy)

    def home(self) -> Coords:
        return self.move_to(*self.HOME_POSITION)


def _distance(a: Coords, b: Coords):
    return math.hypot(a[0] - b[0], a[1] - b[1])

def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))

class MotionError(Exception):
    pass


# ---------------------------------------------------------------------------
# Smiley face -- fixed test pattern, deliberately simple (big smooth curves,
# generous point spacing) since fine detail is wasted on a machine that
# isn't precise enough for it.
# ---------------------------------------------------------------------------


def _circle_points(cx, cy, r, segments=48) -> list[Coords]:
    return [
        (cx + r * math.cos(2 * math.pi * i / segments), cy + r * math.sin(2 * math.pi * i / segments))
        for i in range(segments + 1)
    ]


def _arc_points(cx, cy, r, start_deg, end_deg, segments=24) -> list[Coords]:
    points = []
    for i in range(segments + 1):
        t = start_deg + (end_deg - start_deg) * i / segments
        rad = math.radians(t)
        points.append((cx + r * math.cos(rad), cy + r * math.sin(rad)))
    return points


def generate_smiley_path() -> list[Coords]:
    """Returns an ordered list of (x, y) mm waypoints: face, left eye, right
    eye, mouth, each connected in sequence (the pen never lifts, so the
    moves between shapes are just more line -- same as everywhere else)."""
    cx, cy = Polargraph.HOME_POSITION
    face = _circle_points(cx, cy, 150)
    left_eye = _circle_points(cx - 60, cy - 50, 15)
    right_eye = _circle_points(cx + 60, cy - 50, 15)
    mouth = _arc_points(cx, cy + 20, 90, 20, 160)  # bottom arc of a circle = a smile, in a y-down space
    return face + left_eye + right_eye + mouth
