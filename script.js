var confettiCanvas = document.getElementById('confetti');
var confettiCount = 200;
var confettiDefaults = {
  origin: { y: 0.6, x: 0.75 }
};

confettiCanvas.confetti = confettiCanvas.confetti || confetti.create(confettiCanvas, { resize: true });

function fire(particleRatio, opts) {
  confettiCanvas.confetti(Object.assign({}, confettiDefaults, opts, {
    particleCount: Math.floor(confettiCount * particleRatio)
  }));
}

function toss() {
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}
