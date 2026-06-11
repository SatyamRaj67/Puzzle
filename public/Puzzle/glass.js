var $;
var w;
var h;
var img;
var d;
var cracks = [];

var clickCount = 0;
var isCracked = false;

window.onload = function () {
    var canvas = document.getElementById("glass");

    canvas.width = w = window.innerWidth;
    canvas.height = h = window.innerHeight;

    $ = canvas.getContext("2d");

    window.addEventListener("pointerdown", handleInteraction, false);
    window.addEventListener("resize", resize, false);

    function resize() {
        canvas.width = w = window.innerWidth;
        canvas.height = h = window.innerHeight;
    }

    function handleInteraction(e) {
        if (isCracked) return;

        clickCount++;

        var x = e.clientX;
        var y = e.clientY;

        if (clickCount === 1) {
            for (var i = 0; i < 15; i++) {
                cracks.push(new Crack(x + rnd(5), y + rnd(5), Math.random() * 360 * Math.PI / 180, 20));
            }
            shatterInstantly();
            audio = new Audio('glass-shatter_1.mp3');
            audio.play();
            
        } else if (clickCount === 2) {
            return;
            
        } else if (clickCount === 3) {
            var screenLength = Math.max(w, h);
            for (var i = 0; i < 60; i++) {
                cracks.push(new Crack(x + rnd(5), y + rnd(5), Math.random() * 360 * Math.PI / 180, screenLength));
            }
            shatterInstantly();
            audio = new Audio('glass-shatter_2.mp3');
            audio.play();
        } else if (clickCount >= 4) {
            isCracked = true;
            canvas.classList.add("shattered");
        }
    }
}

function shatterInstantly() {
    var iterations = 0;
    var maxIterations = 500; 

    while (cracks.length > 0 && iterations < maxIterations) {
        img = $.getImageData(0, 0, w, h);
        d = img.data;

        for (var i = cracks.length - 1; i >= 0; i--) {
            var crack = cracks[i];
            crack.update();

            if (!crack.done && Math.random() > 0.85 && cracks.length < 300) {
                cracks.push(new Crack(crack.x, crack.y, (Math.random() > 0.5 ? 90 : -90) * Math.PI / 180 + crack.ang, crack.maxSpan));
            }
        }
        iterations++;
    }
    
    cracks = [];
}

function rnd(num) {
    return Math.random() * num - num * 0.5;
}

var Crack = function (x, y, ang, maxSpan) {
    this.x = x;
    this.y = y;

    this.ang = ang + rnd(0.2);

    this.dx = Math.cos(this.ang);
    this.dy = Math.sin(this.ang);

    this.maxSpan = maxSpan;
    this.span = Math.random() * maxSpan + (maxSpan / 2);
    this.done = false;
}

Crack.prototype.update = function () {
    $.strokeStyle = 'hsla(255,255%,255%,.8)';
    $.beginPath();
    $.moveTo(this.x, this.y);

    this.x += this.dx * 2;
    this.y += this.dy * 2;
    this.span -= 2;

    $.lineTo(this.x, this.y);
    $.stroke();

    var idx = (Math.floor(this.x) + w * Math.floor(this.y)) * 4;

    if (this.span <= 0) {
        this.end();
    }

    // === Collision Detection ===
    if (idx >= 0 && idx < d.length && d[idx + 3] > 0) {
        this.end();
    }

    if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
        this.end();
    }
}

Crack.prototype.end = function () {
    var index = cracks.indexOf(this);
    if (index !== -1) {
        cracks.splice(index, 1);
    }
    this.done = true;
}