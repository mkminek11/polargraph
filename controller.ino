/*
 * ONE Arduino driving BOTH 28BYJ-48 steppers (through two ULN2003 boards)
 * over a single serial (COM) port.
 *
 * This Arduino knows nothing about the polargraph's (x, y) geometry, and
 * -- unlike an earlier version of this sketch -- it doesn't track any
 * absolute position either. It just executes relative step moves:
 *
 *     MOVE <leftDelta> <rightDelta>\n
 *
 * -> step the left motor by <leftDelta> steps and the right motor by
 *    <rightDelta> steps (either can be negative). The Pi (motion_control.py)
 *    computes these deltas from its own tracked position each time.
 *
 * Why relative instead of absolute targets: opening a serial connection
 * resets most Arduino boards (DTR toggles reset), which used to wipe an
 * absolute step counter here and make the next command travel the entire
 * distance from a false zero -- a real move that could take over a minute
 * for what should've been a quick jog. Relative deltas sidestep that
 * completely: a reset here doesn't lose any position information because
 * none is kept -- each MOVE just names how far to travel *right now*.
 *
 * The tradeoff: if a MOVE is ever dropped or garbled in transit, this
 * Arduino has no way to notice or self-correct -- the Pi's tracked
 * position and the gondola's real position will disagree by that amount
 * until you re-home. That's a real risk with plain serial and no ACKs;
 * accepted here in exchange for jogs actually being quick.
 *
 * Both motors step together via a Bresenham interleave, so the motor
 * needing fewer steps is spread evenly across the move instead of
 * finishing early. Replies "OK <leftDelta> <rightDelta>" once done.
 *
 * There is also a continuous-motion command for calibration:
 *
 *     RUN <leftSign> <rightSign>\n
 *
 * -> each field is +1 (pay that cord OUT), -1 (reel it IN), or 0 (stop).
 *    The motor(s) keep stepping until another RUN changes them; "RUN 0 0"
 *    stops both. Unlike MOVE this is non-blocking -- serial is checked every
 *    step -- so a stop takes effect within ~2ms instead of after a backlog
 *    of streamed chunks. Used only during calibration.
 */

const int LEFT_PINS[4]  = {8, 9, 10, 11};  // IN1, IN2, IN3, IN4 -> "left" ULN2003 board
const int RIGHT_PINS[4] = {2, 3, 4, 5};    // IN1, IN2, IN3, IN4 -> "right" ULN2003 board

// ---- DIRECTION / ASSIGNMENT CONFIG ---------------------------------------
// The Pi speaks ONE fixed convention: in "MOVE L R", a POSITIVE number means
// "let that cord OUT (lengthen it)", negative means "reel it IN". The first
// number is always the LEFT cord, the second the RIGHT cord. These flags map
// that convention onto however THIS build physically turns, so hardware
// quirks get fixed here, never in the Pi code or by rewiring.
//
//   LEFT_INVERT / RIGHT_INVERT -> flip the rotation of the motor on that
//                                 board (fixes "motor turns the wrong way").
//   SWAP_MOTORS                -> the two motors are cabled to the opposite
//                                 boards from what the frame expects (fixes
//                                 "jog left drives the right-side cord").
//
// Values below were DERIVED from the measured jog->motor mapping on this
// machine (up=L-/R+, down=L+/R-, right=L-/R-, left=L+/R+): the direction-
// dependent pattern meant the motors are cross-cabled (SWAP) and the right
// one also spins backwards (RIGHT_INVERT). Verified against all four jogs.
const bool LEFT_INVERT  = false;
const bool RIGHT_INVERT = true;
const bool SWAP_MOTORS  = true;

// Delay between half-steps. 28BYJ-48 + ULN2003 will stall or skip steps if
// driven faster than this; raise it if you see missed steps, lower it
// (carefully) if you want more speed.
const unsigned long STEP_DELAY_MS = 2;

// 8-position half-step sequence for a 28BYJ-48 via ULN2003. Advancing an
// index by +1/-1 (mod 8) and re-applying this pattern is what turns that
// motor one way or the other -- there's no separate STEP/DIR pair here.
const uint8_t HALF_STEP_SEQUENCE[8][4] = {
  {1, 0, 0, 0},
  {1, 1, 0, 0},
  {0, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 0},
  {0, 0, 1, 1},
  {0, 0, 0, 1},
  {1, 0, 0, 1},
};

int leftStepIndex = 0;
int rightStepIndex = 0;

void applyStep(const int pins[4], int stepIndex) {
  for (int i = 0; i < 4; i++) {
    digitalWrite(pins[i], HALF_STEP_SEQUENCE[stepIndex][i]);
  }
}

// De-energizes all 4 coils of one motor. No holding torque while idle --
// keeps it cool between moves, at the cost of that side being free to
// drift under gravity/cord tension until the next move locks it back in.
void releaseCoils(const int pins[4]) {
  for (int i = 0; i < 4; i++) {
    digitalWrite(pins[i], LOW);
  }
}

// Steps both motors together, Bresenham-interleaved: the motor needing
// fewer steps gets spread evenly across the move instead of racing ahead
// and finishing early. leftDelta drives LEFT_PINS, rightDelta drives
// RIGHT_PINS -- any left/right SWAP already happened before this is called.
void moveBothBy(long leftDelta, long rightDelta) {
  // Sign gives rotation direction; the *_INVERT flags flip it per board so
  // "positive = pay cord out" holds regardless of winding/wiring.
  int leftDir = ((leftDelta >= 0) ? 1 : -1) * (LEFT_INVERT ? -1 : 1);
  int rightDir = ((rightDelta >= 0) ? 1 : -1) * (RIGHT_INVERT ? -1 : 1);
  long nLeft = abs(leftDelta);
  long nRight = abs(rightDelta);
  long nMax = max(nLeft, nRight);
  if (nMax == 0) return;

  long errLeft = 0;
  long errRight = 0;
  for (long i = 0; i < nMax; i++) {
    errLeft += nLeft;
    errRight += nRight;

    bool doLeft = errLeft >= nMax;
    bool doRight = errRight >= nMax;

    // When nLeft == nRight (e.g. any pure vertical jog: the two motors
    // are equidistant from home, so both need identical step counts),
    // both thresholds cross on the same iteration, every iteration --
    // that means both coils would switch at the exact same instant,
    // continuously. Two 28BYJ-48s switching in unison can momentarily
    // pull enough combined current to sag a marginal 5V supply and make
    // one motor lose torque and buzz. Staggering them by a few hundred
    // microseconds avoids that peak without slowing the move down in any
    // way a pen-plotter speed would notice.
    if (doLeft) {
      leftStepIndex = (leftStepIndex + leftDir + 8) % 8;
      applyStep(LEFT_PINS, leftStepIndex);
      errLeft -= nMax;
    }
    if (doLeft && doRight) {
      delayMicroseconds(300);
    }
    if (doRight) {
      rightStepIndex = (rightStepIndex + rightDir + 8) % 8;
      applyStep(RIGHT_PINS, rightStepIndex);
      errRight -= nMax;
    }
    delay(STEP_DELAY_MS);
  }

  releaseCoils(LEFT_PINS);
  releaseCoils(RIGHT_PINS);
}

String inputBuffer = "";

// Continuous-run direction for each board: -1, 0, or +1. Nonzero means that
// motor takes one step every loop iteration until told otherwise. This is
// how calibration runs: the Pi sends ONE "RUN" command to start a motor and
// ONE to stop it, instead of streaming thousands of tiny MOVE chunks. That
// streaming was flooding the serial buffer faster than the (blocking) MOVE
// handler could drain it -- which made "stop" lag by seconds (backlog) and
// corrupted command framing on buffer overflow (motors moving one at a time
// instead of together). With RUN, stop is processed within one step (~2ms)
// and both motors step together. Directions are stored with swap/invert
// already applied, exactly like MOVE.
int runLeftDir = 0;
int runRightDir = 0;

void processLine(const String &line) {
  if (line.startsWith("MOVE ")) {
    // Discrete relative move (jog / draw / motor-test). Blocks until done.
    String rest = line.substring(5);
    int spaceIndex = rest.indexOf(' ');
    if (spaceIndex > 0) {
      long leftDelta = rest.substring(0, spaceIndex).toInt();
      long rightDelta = rest.substring(spaceIndex + 1).toInt();
      // Route the Pi's left/right cord deltas to the physical boards,
      // swapping if the motors are cabled to the opposite drivers.
      if (SWAP_MOTORS) {
        moveBothBy(rightDelta, leftDelta);
      } else {
        moveBothBy(leftDelta, rightDelta);
      }
      // Reply with the original Pi values (pre-swap) so the log matches
      // exactly what was sent.
      Serial.print("OK ");
      Serial.print(leftDelta);
      Serial.print(" ");
      Serial.println(rightDelta);
    }
  } else if (line.startsWith("RUN ")) {
    // Continuous run for calibration. Each field is a sign: +1 = pay that
    // cord OUT, -1 = reel it IN, 0 = stop that motor. "RUN 0 0" stops both.
    String rest = line.substring(4);
    int spaceIndex = rest.indexOf(' ');
    if (spaceIndex > 0) {
      long sLeft = rest.substring(0, spaceIndex).toInt();
      long sRight = rest.substring(spaceIndex + 1).toInt();
      int dLeft = (sLeft > 0) - (sLeft < 0);    // clamp to -1 / 0 / +1
      int dRight = (sRight > 0) - (sRight < 0);
      // Same swap + per-board invert as MOVE, so "pay out" means the same
      // physical direction in both command paths.
      int aLeft = dLeft, aRight = dRight;
      if (SWAP_MOTORS) {
        aLeft = dRight;
        aRight = dLeft;
      }
      runLeftDir = aLeft * (LEFT_INVERT ? -1 : 1);
      runRightDir = aRight * (RIGHT_INVERT ? -1 : 1);
      // Release the coils of any motor we just stopped (no idle holding
      // torque / heat).
      if (runLeftDir == 0) releaseCoils(LEFT_PINS);
      if (runRightDir == 0) releaseCoils(RIGHT_PINS);
      Serial.print("RUN ");
      Serial.print(sLeft);
      Serial.print(" ");
      Serial.println(sRight);
    }
  }
}

// Non-blocking: drains whatever serial bytes are ready and processes any
// complete lines. Called every loop iteration so a RUN/stop mid-motion is
// picked up almost immediately.
void pollSerial() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      inputBuffer.trim();
      processLine(inputBuffer);
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
    }
  }
}

// One step of whichever motors are currently in continuous-run mode. Both
// step together when both are running, with the same current-stagger as a
// discrete move.
void stepRunOnce() {
  if (runLeftDir != 0) {
    leftStepIndex = (leftStepIndex + runLeftDir + 8) % 8;
    applyStep(LEFT_PINS, leftStepIndex);
  }
  if (runLeftDir != 0 && runRightDir != 0) {
    delayMicroseconds(300);
  }
  if (runRightDir != 0) {
    rightStepIndex = (rightStepIndex + runRightDir + 8) % 8;
    applyStep(RIGHT_PINS, rightStepIndex);
  }
  delay(STEP_DELAY_MS);
}

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(LEFT_PINS[i], OUTPUT);
    pinMode(RIGHT_PINS[i], OUTPUT);
  }
  releaseCoils(LEFT_PINS);
  releaseCoils(RIGHT_PINS);
  Serial.begin(115200);
  Serial.println("READY");
}

void loop() {
  pollSerial();
  if (runLeftDir != 0 || runRightDir != 0) {
    stepRunOnce();
  }
}
