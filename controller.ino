/*
 * ONE Arduino driving BOTH 28BYJ-48 steppers (through two ULN2003 boards)
 * over a single serial (COM) port.
 *
 * This Arduino knows nothing about the polargraph's (x, y) geometry -- it
 * only tracks each motor's own absolute step position and understands one
 * command over serial (from the Raspberry Pi / Flask backend,
 * motion_control.py):
 *
 *   GOTO <left> <right>\n
 *
 * -> move the left motor's shaft to absolute step position <left> and the
 *   right motor's to <right>, counted from 0 at power-on (0 steps =
 *   wherever each cord happened to be when this Arduino was last reset --
 *   see WIRING.md for the one-time calibration this implies).
 *
 * Sending ABSOLUTE targets rather than relative deltas means a single
 * dropped/garbled command can't compound into drift: the next GOTO still
 * names the exact position wanted.
 *
 * Both motors step together via a Bresenham interleave, so the motor
 * needing fewer steps is spread evenly across the move instead of
 * finishing early -- both cords arrive at their new length at the same
 * time. Replies "OK <left> <right>" once the move completes.
 */

const int LEFT[4]    = {8, 9, 10, 11};    // IN1, IN2, IN3, IN4
const int RIGHT[4] = {2, 3, 4, 5};        // IN1, IN2, IN3, IN4

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
long leftPosition = 0;     // absolute step count from power-on reference
long rightPosition = 0;
String inputBuffer = "";

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
// and finishing early.
void moveBothTo(long leftTarget, long rightTarget) {
    long leftDelta = leftTarget - leftPosition;
    long rightDelta = rightTarget - rightPosition;
    int leftDir = (leftDelta >= 0) ? 1 : -1;
    int rightDir = (rightDelta >= 0) ? 1 : -1;
    long nLeft = abs(leftDelta);
    long nRight = abs(rightDelta);
    long nMax = max(nLeft, nRight);

    long errLeft = 0;
    long errRight = 0;
    for (long i = 0; i < nMax; i++) {
        errLeft += nLeft;
        errRight += nRight;

        bool doLeft = errLeft >= nMax;
        bool doRight = errRight >= nMax;

        // When nLeft == nRight (e.g. any pure vertical move: the two motors
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
            applyStep(LEFT, leftStepIndex);
            errLeft -= nMax;
        }
        if (doLeft && doRight) {
            delayMicroseconds(300);
        }
        if (doRight) {
            rightStepIndex = (rightStepIndex + rightDir + 8) % 8;
            applyStep(RIGHT, rightStepIndex);
            errRight -= nMax;
        }
        delay(STEP_DELAY_MS);
    }

    leftPosition = leftTarget;
    rightPosition = rightTarget;
    releaseCoils(LEFT);
    releaseCoils(RIGHT);
}



void setup() {
    for (int i = 0; i < 4; i++) {
        pinMode(LEFT[i], OUTPUT);
        pinMode(RIGHT[i], OUTPUT);
    }
    releaseCoils(LEFT);
    releaseCoils(RIGHT);
    Serial.begin(115200);
    Serial.println("READY");
}

void loop() {
    while (Serial.available() > 0) {
        char c = Serial.read();
        if (c == '\n') {
            inputBuffer.trim();
            if (inputBuffer.startsWith("GOTO ")) {
                String rest = inputBuffer.substring(5);
                int spaceIndex = rest.indexOf(' ');
                if (spaceIndex > 0) {
                    long leftTarget = rest.substring(0, spaceIndex).toInt();
                    long rightTarget = rest.substring(spaceIndex + 1).toInt();
                    moveBothTo(leftTarget, rightTarget);
                    Serial.print("OK ");
                    Serial.print(leftTarget);
                    Serial.print(" ");
                    Serial.println(rightTarget);
                }
            }
            inputBuffer = "";
        } else if (c != '\r') {
            inputBuffer += c;
        }
    }
}
