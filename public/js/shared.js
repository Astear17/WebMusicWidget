// shared.js

document.addEventListener("DOMContentLoaded", () => {
    const widget = document.getElementById("widget");
    const titleText = document.getElementById("titleText");
    const titleInner = document.getElementById("titleInner");
    const titleTrack = document.getElementById("titleTrack");
    const artistText = document.getElementById("artistText");
    const artistInner = document.getElementById("artistInner");
    const artistTrack = document.getElementById("artistTrack");
    const progressKnob = document.getElementById("progressKnob");
    const progressBar = document.getElementById("progressBar");
    const currentTimeEl = document.getElementById("currentTime");
    const totalTimeEl = document.getElementById("totalTime");
    const albumCover = document.getElementById("albumCover");
    const albumImage = document.getElementById("albumImage");
    const vuDots = document.querySelectorAll('.vu-dot');

    const SCROLL_SPEED_PX_PER_SEC = 40;
    const GAP = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";

    let currentTitle = "";
    let currentArtist = "";
    let currentCover = "";

    let vuInterval = null;
    function updateVuMeter(isPlaying) {
        if (!vuDots || vuDots.length === 0) return;
        if (!isPlaying) {
            if (vuInterval) {
                clearInterval(vuInterval);
                vuInterval = null;
            }
            vuDots.forEach(d => d.classList.remove('active'));
            return;
        }
        if (!vuInterval) {
            vuInterval = setInterval(() => {
                const activeCount = Math.floor(Math.random() * 5) + 2; 
                vuDots.forEach((d, i) => {
                    if (i < activeCount) d.classList.add('active');
                    else d.classList.remove('active');
                });
            }, 150);
        }
    }

    function applyMarquee(textEl, innerEl, trackEl, content) {
        if (!textEl || !innerEl || !trackEl) return;
        innerEl.classList.remove("scrolling");
        innerEl.style.removeProperty("--scroll-duration");
        textEl.textContent = content;
        innerEl.innerHTML = "";
        innerEl.appendChild(textEl);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const textWidth = innerEl.scrollWidth;
                const trackWidth = trackEl.clientWidth;

                if (textWidth > trackWidth) {
                    const clone = textEl.cloneNode(true);
                    const gapSpan = document.createElement("span");
                    gapSpan.textContent = GAP;
                    innerEl.appendChild(gapSpan);
                    innerEl.appendChild(clone);

                    const totalWidth = textWidth + gapSpan.offsetWidth;
                    const duration = totalWidth / SCROLL_SPEED_PX_PER_SEC;
                    innerEl.style.setProperty("--scroll-duration", duration + "s");
                    innerEl.classList.add("scrolling");
                }
            });
        });
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins.toString().padStart(2, '0') + ":" + secs.toString().padStart(2, '0');
    }

    let lastData = null;
    let lastUpdateTimestamp = 0;

    function renderState(data) {
        lastData = data;
        lastUpdateTimestamp = Date.now();

        if (!data || data.type === "clear" || !data.player) {
            if (widget) widget.classList.remove("visible");
            if (titleText) titleText.textContent = "Waiting for Media...";
            if (artistText) artistText.textContent = "No data detected";
            currentCover = "";
            if (albumCover) albumCover.classList.remove("has-image");
            updateVuMeter(false);
            if (widget) widget.classList.add("visible");
            
            // Custom event for themes to hook into
            document.dispatchEvent(new CustomEvent('mediaStateClear'));
            return;
        }

        const p = data.player;
        const title = p.title || "Untitled";
        let artist = p.artist || p.name || "Unknown";
        if (p.album && p.album.trim().length > 0) {
            artist = artist + " / " + p.album;
        }
        
        const isPlaying = p.state === 0;

        if (title !== currentTitle) {
            currentTitle = title;
            applyMarquee(titleText, titleInner, titleTrack, title);
        }

        if (artist !== currentArtist) {
            currentArtist = artist;
            applyMarquee(artistText, artistInner, artistTrack, artist);
        }

        // Cover Image
        if (p.coverSrc && p.coverSrc !== currentCover) {
            currentCover = p.coverSrc;
            if (albumImage) albumImage.src = p.coverSrc;
            if (albumCover) albumCover.classList.add("has-image");
        } else if (!p.coverSrc) {
            currentCover = "";
            if (albumCover) albumCover.classList.remove("has-image");
        }

        if (isPlaying) {
            if (widget) widget.classList.remove("paused");
            updateVuMeter(true);
        } else {
            if (widget) widget.classList.add("paused");
            updateVuMeter(false);
        }

        if (widget) widget.classList.add("visible");
        
        // Custom event for themes to hook into
        document.dispatchEvent(new CustomEvent('mediaStateUpdate', { detail: { player: p, isPlaying } }));
    }

    let interpolatedPos = 0;
    let lastServerPos = 0;

    function updateProgress() {
        if (!lastData || !lastData.player) return;
        const p = lastData.player;
        const isPlaying = p.state === 0;
        
        if (Math.abs(p.position - lastServerPos) > 0.1) {
            lastServerPos = p.position;
            interpolatedPos = p.position;
        }

        if (isPlaying && lastUpdateTimestamp > 0) {
            const elapsedSinceUpdate = (Date.now() - lastUpdateTimestamp) / 1000;
            if (interpolatedPos < p.duration) {
                interpolatedPos = p.position + elapsedSinceUpdate;
            }
        } else {
            interpolatedPos = p.position;
        }

        let percent = 0;
        if (p.duration > 0) {
            if (interpolatedPos > p.duration) interpolatedPos = p.duration;
            if (interpolatedPos < 0) interpolatedPos = 0;

            percent = (interpolatedPos / p.duration) * 100;
            
            if (progressKnob) progressKnob.style.top = `calc(${percent}% - 6px)`; // Top orientation might vary per theme, will let CSS handle or overwrite
            // To make it more generic, let's also set custom CSS property
            if (widget) widget.style.setProperty('--progress', `${percent}%`);
            
            if (progressBar) {
                // If it's a vertical progress bar we might need height instead of width
                // We'll use CSS variable --progress to let themes use it how they want, but fallback to width for backwards compatibility
                progressBar.style.width = percent + "%"; 
            }
            if (currentTimeEl) currentTimeEl.textContent = formatTime(interpolatedPos);
            if (totalTimeEl) totalTimeEl.textContent = formatTime(p.duration);
        } else {
            if (progressKnob) progressKnob.style.top = "0%";
            if (progressBar) progressBar.style.width = "0%";
            if (widget) widget.style.setProperty('--progress', `0%`);
            if (currentTimeEl) currentTimeEl.textContent = "00:00";
            if (totalTimeEl) totalTimeEl.textContent = "00:00";
        }
        
        // Custom event for continuous updates
        document.dispatchEvent(new CustomEvent('mediaProgressUpdate', { 
            detail: { position: interpolatedPos, duration: p.duration, percent: percent }
        }));
    }

    function tick() {
        updateProgress();
        requestAnimationFrame(tick);
    }
    tick();

    function getWsUrl() {
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        return proto + "//" + location.host + "/ws";
    }

    function connect() {
        const ws = new WebSocket(getWsUrl());

        ws.onopen = () => console.log("[Overlay] Connected");
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                renderState(data);
            } catch (e) {}
        };
        ws.onclose = () => {
            if (widget) widget.classList.remove("visible");
            setTimeout(connect, 3000);
        };
    }

    connect();
});
