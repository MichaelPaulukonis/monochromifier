import { p5 } from 'p5js-wrapper'

const sketch = function (p) {
  let img
  let threshold = 128 // Adjust this value for different threshold levels
  let backgroundColor
  let buffer
  let displayBuffer
  let paintBuffer
  let bwBuffer = null
  let lastThreshold = null
  let dirty = false
  let scaleRatio = 1
  let invert = false
  let sizeRatio = 1
  let paintMode = false
  let brushSize = 10
  const density = 1

  p.preload = function () {
    img = p.loadImage('./sample_images/phone.00.jpg')
  }

  p.setup = function () {
    p.pixelDensity(density)
    const c = p.createCanvas(600, 600)
    c.drop(handleFile)
    p.imageMode(p.CENTER)
    backgroundColor = p.color(255, 255, 255)
    p.background(backgroundColor)

    buffer = p.createGraphics(1000, 1000)
    buffer.imageMode(p.CENTER)
    buffer.pixelDensity(density)
    paintBuffer = p.createGraphics(1000, 1000)
    paintBuffer.imageMode(p.CENTER)
    paintBuffer.clear()
    paintBuffer.pixelDensity(density)
    displayBuffer = p.displayCombined(img)
  }

  p.draw = function () {
    // SHIFT is now for "fine-tuning", default is 10
    const change = p.keyIsDown(p.SHIFT) ? 1 : 10

    if (paintMode) {
      if (p.keyIsDown(p.RIGHT_ARROW)) {
        brushSize = p.constrain(brushSize + change, 1, 100)
        displayBuffer = p.displayCombined(img)
      } else if (p.keyIsDown(p.LEFT_ARROW)) {
        brushSize = p.constrain(brushSize - change, 1, 100)
        displayBuffer = p.displayCombined(img)
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

    if (displayBuffer && dirty) {
      p.background(backgroundColor)
      p.image(displayBuffer, p.width / 2, p.height / 2, p.width, p.height)

      dirty = false

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
  }

  p.mouseDragged = function () {
    if (
      paintMode &&
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      const scaledMouseX = p.mouseX * scaleRatio
      const scaledMouseY = p.mouseY * scaleRatio
      const scaledPmouseX = p.pmouseX * scaleRatio
      const scaledPmouseY = p.pmouseY * scaleRatio

      paintBuffer.stroke(255)
      paintBuffer.strokeWeight(brushSize)
      paintBuffer.line(scaledPmouseX, scaledPmouseY, scaledMouseX, scaledMouseY)
      // TODO: now that b&w is cached,  update the paint buffer
      displayBuffer = p.displayCombined(img)
      dirty = true
      // console.log(scaledPmouseX, scaledPmouseY, scaledMouseX, scaledMouseY);
    }
  }

  // p.mouseReleased = function () {
  //   if (paintMode) {
  //     displayBuffer = p.displayCombined(img)
  //     dirty = true
  //   }
  // }

  p.keyPressed = function () {
    if ((p.keyIsDown(p.CONTROL) || p.keyIsDown(91)) && p.key === 's') {
      p.save(buffer, generateFilename())
      return false // Prevent default browser behavior
    }
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
    }
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

  // TODO: don't have to scale it, here
  // monochrome the origin, scale for everything else
  p.getMonochromeImage = function (img, threshold) {
    if (bwBuffer && lastThreshold === threshold) {
      return bwBuffer
    }

    const newImg = p.createImage(img.width, img.height)
    newImg.copy(
      img,
      0,
      0,
      img.width, img.height,
      0, 0,
      img.width, img.height
    )

    newImg.loadPixels()
    const pd = p.pixelDensity()
    for (let y = 0; y < img.height * pd; y++) {
      for (let x = 0; x < img.width * pd; x++) {
        const index = (x + y * img.width * pd) * 4
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
  // TODO: only redo monochromification if threshold changes
  // otherwise cache
  // painting is on un-cropped/unzoomed version
  // this simplifies all the stupid math stuff
  // and improves speed( just caching would it, too)
  p.displayCombined = function (img) {
    scaleRatio = p.calculateScaleRatio(img)
    const scaledWidth = Math.round(img.width * scaleRatio)
    const scaledHeight = Math.round(img.height * scaleRatio)

    const newImg = p.getMonochromeImage(img, threshold)

    // Combine monochrome image and paint buffer
    const combinedImage = p.createGraphics(scaledWidth, scaledHeight)
    combinedImage.pixelDensity(density)
    // combinedImage.imageMode(p.CENTER)
    combinedImage.image(newImg, 0, 0, scaledWidth, scaledHeight, 0, 0, img.width, img.height)
    combinedImage.image(paintBuffer, 0, 0, scaledWidth, scaledHeight)

    const croppedImg = p.cropWhitespace(combinedImage)

    // Scale the cropped image to ensure it is as large as possible
    // and apply zoom
    const finalScaleRatio = p.calculateScaleRatio(croppedImg)
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

    buffer.background(backgroundColor)
    buffer.image(finalImg, buffer.width / 2, buffer.height / 2)
    // console.log(buffer.width, buffer.height, finalImg.width, finalImg.height);
    dirty = true
    return buffer
  }

  p.calculateScaleRatio = function (img) {
    const maxSize = 1000
    const maxImgSize = Math.max(img.width, img.height)
    return maxSize / maxImgSize
  }

  p.calculateInitialSizeRatio = function (img) {
    const canvasSize = Math.min(p.width, p.height)
    const imgSize = Math.max(img.width, img.height)
    return canvasSize / imgSize
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

  p.cropWhitespace = function (img) {
    img.loadPixels()
    let top = 0
    let bottom = img.height - 1
    let left = 0
    let right = img.width - 1
    const pd = p.pixelDensity()

    // Find top boundary
    outer: for (let y = 0; y < img.height * pd; y++) {
      for (let x = 0; x < img.width * pd; x++) {
        const index = (x + y * img.width * pd) * 4
        if (
          img.pixels[index] !== p.red(backgroundColor) ||
          img.pixels[index + 1] !== p.green(backgroundColor) ||
          img.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          top = y
          break outer
        }
      }
    }

    // Find bottom boundary
    outer: for (let y = img.height * pd - 1; y >= 0; y--) {
      for (let x = 0; x < img.width * pd; x++) {
        const index = (x + y * img.width * pd) * 4
        if (
          img.pixels[index] !== p.red(backgroundColor) ||
          img.pixels[index + 1] !== p.green(backgroundColor) ||
          img.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          bottom = y
          break outer
        }
      }
    }

    // Find left boundary
    outer: for (let x = 0; x < img.width * pd; x++) {
      for (let y = 0; y < img.height * pd; y++) {
        const index = (x + y * img.width * pd) * 4
        if (
          img.pixels[index] !== p.red(backgroundColor) ||
          img.pixels[index + 1] !== p.green(backgroundColor) ||
          img.pixels[index + 2] !== p.blue(backgroundColor)
        ) {
          left = x
          break outer
        }
      }
    }

    // Find right boundary
    outer: for (let x = img.width * pd - 1; x >= 0; x--) {
      for (let y = 0; y < img.height * pd; y++) {
        const index = (x + y * img.width * pd) * 4
        if (
          img.pixels[index] !== p.red(backgroundColor) ||
          img.pixels[index + 1] !== p.green(backgroundColor) ||
          img.pixels[index + 2] !== p.blue(backgroundColor)
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
      img,
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
