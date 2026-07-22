# Wiring — one Arduino, two motors

One Arduino Uno (or compatible) drives both 28BYJ-48 steppers, each through
its own ULN2003 driver board. The Arduino talks to the Raspberry Pi over a
single USB/serial connection.

See `wiring_diagram.svg` for the visual version of this table.

## Pin assignment

| Arduino pin | Goes to | Motor |
|---|---|---|
| D8  | ULN2003 #1 (left) — IN1 | Left |
| D9  | ULN2003 #1 (left) — IN2 | Left |
| D10 | ULN2003 #1 (left) — IN3 | Left |
| D11 | ULN2003 #1 (left) — IN4 | Left |
| D2  | ULN2003 #2 (right) — IN1 | Right |
| D3  | ULN2003 #2 (right) — IN2 | Right |
| D4  | ULN2003 #2 (right) — IN3 | Right |
| D5  | ULN2003 #2 (right) — IN4 | Right |

Pins D0/D1 are left alone — those are the Arduino's hardware serial
(RX/TX), used for the USB connection to the Pi. Don't wire anything to them.

## Power

- Each ULN2003 board has its own **5V / GND** screw terminals (separate from
  the IN1–IN4 signal header) — this is what actually powers the motor
  coils. Feed both boards from a single external 5V supply if you have one;
  the Arduino's own 5V pin can work for one or two 28BYJ-48s but is safer
  to avoid for anything more.
- Tie the external 5V supply's **GND to the Arduino's GND** as well (common
  ground) — the signal pins won't work reliably without it, even though
  power comes from elsewhere.
- Each ULN2003 board's motor connector is a single 5-pin JST plug that
  matches the 28BYJ-48's cable exactly — there's only one way it fits.

## Connecting to the Raspberry Pi

- Arduino to Pi: a single USB cable. This is both the power source for the
  Arduino itself and the serial link the Flask backend (`app.py`) uses to
  send `GOTO <left> <right>` commands.
- In the web UI, pick whatever COM port this Arduino enumerates as (on the
  Pi it'll be something like `/dev/ttyUSB0` or `/dev/ttyACM0` — the
  dropdown lists whatever's actually present) and connect at 115200 baud
  to match `Serial.begin(115200)` in the sketch.

## Troubleshooting: one motor buzzes/vibrates but doesn't turn, only on vertical jog

Home `(300, 400)` sits exactly on the horizontal midpoint between the two
motors, so any pure vertical move (jog UP/DOWN) needs the *exact same* step
count on both sides — which makes both motors switch coils at the literal
same instant, continuously, for that whole move. Horizontal moves almost
never line up like that, so the two motors' switching naturally staggers
instead.

Two 28BYJ-48s drawing current at the same instant (roughly double the
current of one) can sag a marginal 5V supply just enough for one motor to
lose torque and buzz in place without turning — while the staggered
horizontal case works fine because it never hits that combined peak. If you
see this: **power both ULN2003 boards from a proper external 5V supply**
(see Power, above) rather than the Arduino's own 5V pin. The firmware also
staggers same-instant steps by a few hundred microseconds as a software
mitigation, but that doesn't replace giving the motors enough current.

## One-time calibration note

The sketch tracks each motor's position as a step count **from wherever it
happened to be when the Arduino was last reset** (position 0 at power-on).
That means: after wiring everything up, physically position the gondola at
the drawing area's home point *before* powering the Arduino for the first
time (or before pressing its reset button), so that its internal "0" lines
up with the web app's actual home position. If it's ever out of sync,
power-cycle the Arduino with the gondola manually held at home.
