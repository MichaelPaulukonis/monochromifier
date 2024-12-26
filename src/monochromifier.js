import { p5 } from 'p5js-wrapper'

const sketch = function (p) {
  let img
  let threshold = 128 // Adjust this value for different threshold levels
  let backgroundColor
  let displayBuffer
  let paintBuffer
  let combinedImage = null
  let bwBuffer = null
  let lastThreshold = null
  let dirty = false
  let invert = false
  let sizeRatio = 1
  let paintMode = false
  let brushSize = 10
  const density = 1
  const displaySize = 600
  const outputSize = 1000
  let previousMouse = { x: 0, y: 0 }

  p.preload = function () {
    img = p.loadImage('./sample_images/unicum.00.jpg')
  }

  p.setup = function () {
    p.pixelDensity(density)
    const c = p.createCanvas(displaySize, displaySize)
    c.drop(handleFile)
    p.imageMode(p.CENTER)
    backgroundColor = p.color(255, 255, 255)
    p.background(backgroundColor)

    displayBuffer = p.createGraphics(outputSize, outputSize)
    displayBuffer.pixelDensity(density)
    displayBuffer.imageMode(p.CENTER)

    paintBuffer = p.createGraphics(img.width, img.height)
    paintBuffer.pixelDensity(density)
    paintBuffer.imageMode(p.CENTER)
    paintBuffer.clear()

    displayBuffer = p.displayCombined(img)
  }

  p.draw = function () {
    debounceKeys()
    if (displayBuffer && dirty) {
      p.background(backgroundColor)
      p.image(displayBuffer, p.width / 2, p.height / 2, p.width, p.height)

      dirty = false

      p.displayUI()
    }
  }

  p.displayUI = function () {
    p.fill('blue')
    p.noStroke()
    p.textSize(16)
    p.text(`threshold: ${threshold}`, 10, p.height - 70)
    p.text(`zoom: ${(sizeRatio * 100).toFixed(0)}%`, 10, p.height - 50)
    p.text(`paint mode: ${paintMode ? 'ON' : 'OFF'}`, 10, p.height - 30)
    if (paintMode) {
      p.text(`brush size: ${brushSize}`, 10, p.height - 10)
    }
  }

  function debounce (func, wait) {
    let timeout
    return function executedFunction (...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  p.mouseDragged = function () {
    // Debounced version of mouseDragged
    const debouncedMouseDragged = debounce((x, y, brushSize) => {
      paintBuffer.stroke(255)
      paintBuffer.strokeWeight(brushSize)
      paintBuffer.line(previousMouse.x, previousMouse.y, x, y)
      previousMouse = { x, y }
      displayBuffer = p.displayPaint(img)
      dirty = true
    }, 16) // 60fps = ~16ms between frames

    if (
      paintMode &&
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      debouncedMouseDragged(p.mouseX, p.mouseY, brushSize)
    }
  }

  p.mouseReleased = function () {
    previousMouse = { x: 0, y: 0 }
  }

  p.mousePressed = function () {
    previousMouse = { x: p.mouseX, y: p.mouseY }
  }

  const specialKeys = () => {
    const change = p.keyIsDown(p.SHIFT) ? 1 : 10

    if (paintMode) {
      if (p.keyIsDown(p.RIGHT_ARROW)) {
        brushSize = p.constrain(brushSize + change, 1, 100)
        displayBuffer = p.displayPaint(img)
      } else if (p.keyIsDown(p.LEFT_ARROW)) {
        brushSize = p.constrain(brushSize - change, 1, 100)
        displayBuffer = p.displayPaint(img)
      }
    } else {
      if (p.keyIsDown(p.RIGHT_ARROW)) {
        sizeRatio = p.constrain(sizeRatio + change / 100, 0.01, 10)
        displayBuffer = p.displayCombined(img)
      } else if (p.keyIsDown(p.LEFT_ARROW)) {
        sizeRatio = p.constrain(sizeRatio - change / 100, 0.01, 10)
        displayBuffer = p.displayCombined(img)
      }
    }

    if (p.keyIsDown(p.UP_ARROW)) {
      threshold = p.constrain(threshold + change, 0, 255)
      displayBuffer = p.displayCombined(img)
    } else if (p.keyIsDown(p.DOWN_ARROW)) {
      threshold = p.constrain(threshold - change, 0, 255)
      displayBuffer = p.displayCombined(img)
    }

    if ((p.keyIsDown(p.CONTROL) || p.keyIsDown(91)) && p.key === 's') {
      p.save(displayBuffer, generateFilename())
      return false // Prevent default browser behavior
    }
    return false
  }

  let debounceKeys = debounce(specialKeys, 17)

  p.keyPressed = () => handleKeys()

  const handleKeys = () => {

    if (p.key === 'i') {
      invert = !invert
      backgroundColor = invert ? p.color(0, 0, 0) : p.color(255, 255, 255)
      displayBuffer = p.displayCombined(img)
      dirty = true
    }
    if (p.key === 'r') {
      threshold = 128
      sizeRatio = 1
      displayBuffer = p.displayCombined(img)
      dirty = true
    }
    if (p.key === 'p') {
      paintMode = !paintMode
      dirty = true // just for the UI
      console.log(`paint mode: ${paintMode ? 'ON' : 'OFF'}`)
      if (paintMode) {
        console.log('paint mode: ON')
        p.cursor(p.CROSS)
        p.resizeCanvas(img.width, img.height)
        const tempBuff = p.createGraphics(img.width, img.height)
        tempBuff.pixelDensity(density)
        tempBuff.imageMode(p.CENTER)
        displayBuffer.remove()
        displayBuffer = tempBuff
        p.displayPaint(img)
        previousMouse = { x: p.mouseX, y: p.mouse }
      } else {
        p.cursor()
        p.resizeCanvas(displaySize, displaySize)
        const tempBuff = p.createGraphics(outputSize, outputSize)
        tempBuff.pixelDensity(density)
        tempBuff.imageMode(p.CENTER)
        displayBuffer.remove()
        displayBuffer = tempBuff
        displayBuffer = p.displayCombined(img)
      }
    }
    return false
  }

  function generateFilename () {
    const d = new Date()
    return (
      'monochrome_image.' +
      d.getFullYear() +
      '.' +
      (d.getMonth() + 1) +
      '.' +
      d.getDate() +
      d.getHours() +
      d.getMinutes() +
      d.getSeconds() +
      '.png'
    )
  }

  p.getMonochromeImage = function (img, threshold) {
    if (bwBuffer && lastThreshold === threshold) {
      return bwBuffer
    }

    const newImg = p.createImage(img.width, img.height)
    newImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height)

    newImg.loadPixels()
    for (let y = 0; y < img.height * density; y++) {
      for (let x = 0; x < img.width * density; x++) {
        const index = (x + y * img.width * density) * 4
        const r = newImg.pixels[index]
        const g = newImg.pixels[index + 1]
        const b = newImg.pixels[index + 2]
        const a = newImg.pixels[index + 3]
        const avg = (r + g + b) / 3
        let bw = avg > threshold ? 255 : 0

        if (invert) {
          bw = 255 - bw
        }

        if (a === 0 || bw === (invert ? 0 : 255)) {
          // Transparent pixel (a = 0) sets to background color
          newImg.pixels[index] = p.red(backgroundColor)
          newImg.pixels[index + 1] = p.green(backgroundColor)
          newImg.pixels[index + 2] = p.blue(backgroundColor)
        } else {
          newImg.pixels[index] = invert ? 255 : 0 // Invert black to white
          newImg.pixels[index + 1] = invert ? 255 : 0 // Invert black to white
          newImg.pixels[index + 2] = invert ? 255 : 0 // Invert black to white
        }
        newImg.pixels[index + 3] = 255 // Set alpha to fully opaque
      }
    }
    newImg.updatePixels()

    bwBuffer = newImg
    lastThreshold = threshold

    return newImg
  }

  p.displayPaint = function (img) {
    // to scale this, we also have to have scaled at createGraphics
    // const scaleRatio = calculateScaleRatio(img, outputSize)
    const newImg = p.getMonochromeImage(img, threshold)

    displayBuffer.background(backgroundColor)
    displayBuffer.image(
      newImg,
      displayBuffer.width / 2,
      displayBuffer.height / 2
    )
    displayBuffer.image(
      paintBuffer,
      displayBuffer.width / 2,
      displayBuffer.height / 2
    )

    dirty = true
    return displayBuffer
  }

  p.displayCombined = function (img) {
    const scaleRatio = calculateScaleRatio(img, outputSize)
    const scaledWidth = Math.round(img.width * scaleRatio)
    const scaledHeight = Math.round(img.height * scaleRatio)

    const newImg = p.getMonochromeImage(img, threshold)

    if (combinedImage === null) {
      combinedImage = p.createGraphics(scaledWidth, scaledHeight)
      combinedImage.pixelDensity(density)
    }

    combinedImage.image(
      newImg,
      0,
      0,
      scaledWidth,
      scaledHeight,
      0,
      0,
      img.width,
      img.height
    )
    combinedImage.image(paintBuffer, 0, 0, scaledWidth, scaledHeight)

    const croppedImg = p.cropWhitespace(combinedImage)

    // Scale the cropped image to ensure it is as large as possible
    // and apply zoom
    const finalScaleRatio = calculateScaleRatio(croppedImg, outputSize)
    const finalWidth = Math.round(
      croppedImg.width * finalScaleRatio * sizeRatio
    )
    const finalHeight = Math.round(
      croppedImg.height * finalScaleRatio * sizeRatio
    )
    const finalImg = p.createImage(finalWidth, finalHeight)

    finalImg.copy(
      croppedImg,
      0,
      0,
      croppedImg.width,
      croppedImg.height,
      0,
      0,
      finalWidth,
      finalHeight
    )

    displayBuffer.background(backgroundColor)
    displayBuffer.image(
      finalImg,
      displayBuffer.width / 2,
      displayBuffer.height / 2
    )
    dirty = true
    return displayBuffer
  }

  const calculateScaleRatio = function (img, size) {
    // canvas size should be a square, normally
    // if not, we can reconsider everything
    const maxSize = outputSize
    const maxImgSize = Math.max(img.width, img.height)
    return maxSize / maxImgSize
  }

  function handleFile (file) {
    if (file.type === 'image') {
      img = p.loadImage(file.data, loadedImg => {
        img = loadedImg
        bwBuffer = null
        displayBuffer = p.displayCombined(img)
        dirty = true
      })
    }
  }

  p.cropWhitespace = function (buffer) {
    buffer.loadPixels()
    let top = 0
    let bottom = buffer.height - 1
    let left = 0
    let right = buffer.width - 1

    // Find top boundary
    outer: for (let y = 0; y < buffer.height * density; y++) {
      for (let x = 0; x < buffer.width * density; x++) {
        const index = (x + y * buffer.width * density) * 4
        if (
          buffer.pixels[index] !== p.red(backgroundColor) ||
          buffer.pixels[index + 1] !== p.green(backgroundColor) ||
          buffer.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          top = y
          break outer
        }
      }
    }

    // Find bottom boundary
    outer: for (let y = buffer.height * density - 1; y >= 0; y--) {
      for (let x = 0; x < buffer.width * density; x++) {
        const index = (x + y * buffer.width * density) * 4
        if (
          buffer.pixels[index] !== p.red(backgroundColor) ||
          buffer.pixels[index + 1] !== p.green(backgroundColor) ||
          buffer.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          bottom = y
          break outer
        }
      }
    }

    // Find left boundary
    outer: for (let x = 0; x < buffer.width * density; x++) {
      for (let y = 0; y < buffer.height * density; y++) {
        const index = (x + y * buffer.width * density) * 4
        if (
          buffer.pixels[index] !== p.red(backgroundColor) ||
          buffer.pixels[index + 1] !== p.green(backgroundColor) ||
          buffer.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          left = x
          break outer
        }
      }
    }

    // Find right boundary
    outer: for (let x = buffer.width * density - 1; x >= 0; x--) {
      for (let y = 0; y < buffer.height * density; y++) {
        const index = (x + y * buffer.width * density) * 4
        if (
          buffer.pixels[index] !== p.red(backgroundColor) ||
          buffer.pixels[index + 1] !== p.green(backgroundColor) ||
          buffer.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          right = x
          break outer
        }
      }
    }

    const croppedWidth = right - left + 1
    const croppedHeight = bottom - top + 1
    const croppedImg = p.createImage(croppedWidth, croppedHeight)
    croppedImg.copy(
      buffer,
      left,
      top,
      croppedWidth,
      croppedHeight,
      0,
      0,
      croppedWidth,
      croppedHeight
    )
    return croppedImg
  }
}

new p5(sketch) // eslint-disable-line no-new, new-cap
