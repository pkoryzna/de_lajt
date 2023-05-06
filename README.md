# de_lajt
80s music visualizer spinny thing in your browser

**(big epilepsy warning: this thing is VERY flashy)**

look at it go at 
https://pkoryzna.github.io/de_lajt/

click to start, double click for fullscreen

<a href="https://pkoryzna.github.io/de_lajt/"><img width="1059" alt="Screenshot of the music visualizer in action, lots of green and red lights and stuff" src="https://user-images.githubusercontent.com/3660338/236647678-7b943009-1b0b-4a81-820a-5641c6421f56.png"></a>

## how does this work

Mic input goes through a global gain node. 
That goes into a low-pass filter node for the bass range, and high-pass and low-pass filter combo for mid range.
For each of those a custom AudioWorklet gets a bit of audio (128 samples), puts that in a ring buffer. 
Every time `requestAnimationFrame` calls the drawing callback, it requests via AudioWorklet's `port` to read whatever has been buffered since last frame and once a reply comes back, puts that on screen. 
Every frame blanks the screen a bit to simulate persistence-of-vision effect you'd get if you were staring at a real spinning LED bar. 

idk what else, for details read the code i guess lol

## todos :)

- add knobs for filter cutoffs, colors, samples per full rotation
- make the persistence-of-vision simulation blank the screen at a fixed interval (there's no fixed buffer size rendered every frame atm)
- for the above actually properly track what % of the full circle it's drawn (kinda broken rn)
- add playing of arbitrary media (files or streams) so you can put this on a TV or something
- make the attract mode prettier lol
- try and do something about bass and midrange buffers getting slightly out of sync between callbacks (2 inputs 2 buffers in 1 worklet maybe?)


inspired by Techmoan's video about "The Lyte" electro-mechanical music visualizer 

https://www.youtube.com/watch?v=OR5yhgupt0g

## P.S.

i'm not a js dev lol this is a hobby project 
