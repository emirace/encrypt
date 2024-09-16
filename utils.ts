// Helper function to embed QR code into an image using FormData
export const embedQRCodeInImage = async (imageUri, qrCodeUri) => {
  try {
    const formData = new FormData();

    // Attach the image as a file to the form data
    formData.append("image", {
      uri: imageUri,
      name: "image.png",
      type: "image/png",
    });

    formData.append("qrCode", {
      uri: qrCodeUri,
      name: "qrcode.png",
      type: "image/png",
    });

    const response = await fetch("http://172.20.10.4:3000/embed", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    const result = await response.json();
    return result.imageUri; // Assuming backend responds with a new image URI
  } catch (error) {
    console.error("Error embedding QR code:", error);
    throw error;
  }
};

// Helper function to extract QR code from an image using FormData
export const extractQRCodeFromImage = async (imageUri) => {
  try {
    const formData = new FormData();

    // Attach the image as a file to the form data
    formData.append("image", {
      uri: imageUri,
      name: "image.png",
      type: "image/png",
    });

    const response = await fetch("http://localhost:3000/extract", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    const result = await response.json();
    return result.qrCodeUri; // Assuming backend responds with extracted QR code URI
  } catch (error) {
    console.error("Error extracting QR code:", error);
    throw error;
  }
};

export const compareImagesRedChannelOnly = async (
  imagePixels1,
  imagePixels2
) => {
  // Extract pixel data from both images

  // Check if the lengths of both pixel arrays are the same
  if (imagePixels1.length !== imagePixels2.length) {
    console.log("Image sizes are different.");
    return false; // Images are not the same if the pixel arrays differ in size
  }

  let mismatchCount = 0;

  // Compare only the red channel of each pixel (RGBA format, red is at index i)
  for (let i = 0; i < imagePixels1.length; i += 4) {
    const red1 = imagePixels1[i]; // Red channel in first image
    const red2 = imagePixels2[i]; // Red channel in second image

    // If red channels don't match, log the mismatch
    if (red1 !== red2) {
      mismatchCount++;
      console.log(`Mismatch at pixel index ${i / 4}:`);
      console.log(`Image 1 Red: ${red1}`);
      console.log(`Image 2 Red: ${red2}`);
    }
    if (mismatchCount > 10) break;
  }

  if (mismatchCount === 0) {
    console.log("The red channels of the images are the same!");
    return true;
  } else {
    console.log(`Total mismatched pixels in red channel: ${mismatchCount}`);
    return false;
  }
};
