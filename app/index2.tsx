import React, { useState, useEffect, useRef } from "react";
import { View, Button, TextInput, Image, Text, ScrollView } from "react-native";
import { Buffer } from "buffer";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Camera } from "expo-camera";
import * as Sharing from "expo-sharing";
import jsQR from "jsqr";
// import { BarCodeScanner } from "expo-barcode-scanner";
import jpeg from "jpeg-js"; // Will need to be installed separately
import * as ImageManipulator from "expo-image-manipulator";
import { embedQRCodeInImage } from "@/utils";

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

const App = () => {
  const [message, setMessage] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [image, setImage] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [qrCodeUri, setQrCodeUri] = useState(null);
  const [decodedMessage, setDecodedMessage] = useState(null);
  const qrCodeRef = useRef(null);
  const [fileUri, setFileUri] = useState("");
  const [qrcodePixel, setQrcodePixel] = useState(null);
  const [fisrtPixelData, setFisrtPixelData] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // 1. Select Image using Expo ImagePicker
  const selectImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const { uri, width, height } = result.assets[0];
      setImageUri(uri);
      setImageDimensions({ width, height });
    }
  };

  // Helper function to get base64 image data from a local file
  const getBase64Image = async (uri) => {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64Data}`;
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw error;
    }
  };

  // Main function to embed QR code in an image using the server
  const embedQRCodeInImageOnServer = async () => {
    try {
      console.log("Starting QR Code embedding");

      // Ensure that handleQRCodeRef returns a value
      const qrcodeImage = await handleQRCodeRef();
      if (!qrcodeImage) {
        console.error("Failed to get QR code image.");
        return;
      }

      // Get base64 image data
      const imageBase64 = await getBase64Image(imageUri);
      const qrCodeBase64 = await getBase64Image(qrcodeImage);

      // Embed QR code in the image via server
      const resultImageBase64 = await embedQRCodeInImage(
        imageBase64,
        qrCodeBase64
      );

      // Convert base64 data back to a file URI
      const tempFileUri = FileSystem.cacheDirectory + "encoded_image.jpg";
      await FileSystem.writeAsStringAsync(
        tempFileUri,
        resultImageBase64.replace(/^data:image\/jpeg;base64,/, ""),
        {
          encoding: FileSystem.EncodingType.Base64,
        }
      );

      console.log("Encoded image saved to:", tempFileUri);
      setImage(tempFileUri);

      // Share or download the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempFileUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Save QR Code Image",
        });
      } else {
        Alert.alert("Sharing is not available on this device.");
      }
    } catch (error) {
      console.error("Error during QR Code embedding:", error);
    }
  };

  // 4. Extract Image Pixels
  const extractImagePixels = async (uri) => {
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binaryData = Buffer.from(base64Data, "base64");
    const decodedImage = jpeg.decode(binaryData);
    return decodedImage.data;
  };

  // 6. Embed LSB into the Image

  const embedLSB = (imagePixels, qrCodePixels) => {
    // Ensure the QR code has fewer or equal pixels compared to the image
    if (qrCodePixels.length > imagePixels.length) {
      throw new Error("QR code is too large to fit in the image");
    }

    // Create a new array for the modified image pixels
    const newPixels = new Uint8Array(imagePixels.length);

    // Copy the original image pixels into the new array
    newPixels.set(imagePixels);

    // Embed the LSB of each QR code pixel into the red channel of the new array
    for (let i = 0; i < qrCodePixels.length / 4; i++) {
      const qrPixel = qrCodePixels[i * 4] === 255 ? 1 : 0; // Convert 255 (white) to 1, black (0) remains 0
      const imageRedChannel = newPixels[i * 4]; // Red channel in RGBA format

      // Embed the LSB from the QR code into the red channel of the new array
      newPixels[i * 4] = (imageRedChannel & ~1) | qrPixel; // Only modify the LSB
    }

    return newPixels; // Return the new image pixel data
  };

  // 7. Decode the QR Code from the Image
  const extractQRCodeFromImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;
    const { uri, width, height } = result.assets[0];

    console.log("hello5");

    console.log("encoded image path", uri);
    const imagePixels = await extractImagePixels(uri);
    console.log("hello6", qrcodePixel.length);
    console.log(qrcodePixel.slice(0, 20));
    const qrCodePixels = await extractLSB(imagePixels, width, height);
    console.log(imagePixels.slice(0, 20));
    // console.log(qrCodePixels.slice(0,20));
    console.log("hello7");
    console.log("return pixels length:", qrCodePixels.length);
    console.log(qrCodePixels.slice(0, 20));
    console.log(fisrtPixelData.slice(0, 20));

    const areRedChannelsSame = await compareImagesRedChannelOnly(
      fisrtPixelData,
      qrCodePixels
    );

    if (areRedChannelsSame) {
      console.log("The red channels of the images are identical!");
    } else {
      console.log("The red channels of the images have mismatched pixels.");
    }

    const encodedImage = jpeg.encode(
      {
        data: qrCodePixels,
        width: width,
        height: height,
      },
      100 // JPEG quality
    );

    // Save or display the encoded image
    const path = `${FileSystem.documentDirectory}decoded_image.jpg`;
    await FileSystem.writeAsStringAsync(
      path,
      Buffer.from(encodedImage.data).toString("base64"),
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    console.log("Encoded image saved to:", path);
    setQrCodeUri(path); // Update the image with the new encoded image
    // Display the reconstructed QR code
    console.log("hello8");
    // setQrCodeUri(qrCodeData);

    console.log("hello9");
    // Extract the message from the QR code
    const message = extractMessageFromQRCode(
      qrCodePixels,
      imageDimensions.width,
      imageDimensions.height
    );
    setDecodedMessage(message);
  };

  const extractLSB = async (imagePixels, qrCodeWidth, qrCodeHeight) => {
    // Create an empty array to hold the extracted QR code pixels
    const newQrCodePixels = new Uint8Array(imagePixels.length); // RGBA format

    for (let i = 0; i < qrCodeWidth * qrCodeHeight; i++) {
      // Get the red channel of the image pixel (RGBA format, so red is at [i * 4])
      const imageRedChannel = imagePixels[i * 4];
      // Extract the LSB from the red channel and convert it back to black (0) or white (255)
      const bit = imageRedChannel & 1; // Extract the LSB
      const qrPixel = bit === 1 ? 255 : 0; // Convert bit to black (0) or white (255)

      // Set the pixel in the QR code array (we need RGBA format for consistency)
      newQrCodePixels[i * 4] = qrPixel; // Red channel
      newQrCodePixels[i * 4 + 1] = qrPixel; // Green channel
      newQrCodePixels[i * 4 + 2] = qrPixel; // Blue channel
      newQrCodePixels[i * 4 + 3] = 255; // Alpha channel (fully opaque)

      if (i > qrCodeWidth * qrCodeHeight - 100) {
        console.log(i, imageRedChannel, qrPixel);
      }
    }
    return newQrCodePixels;
  };

  const extractMessageFromQRCode = (qrCodeBits, width, height) => {
    // Convert qrCodeBits back into an image data array that jsQR can process
    const qrCodeImageData = {
      data: qrCodeBits,
      width: width,
      height: height,
    };

    // Use jsQR to scan the QR code
    const code = jsQR(qrCodeImageData.data, width, height);

    if (code) {
      return code.data; // This contains the decoded message
    } else {
      return "Could not decode QR code";
    }
  };

  // 8. QR Code Scanner using Expo Camera
  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    alert(`Decoded message: ${data}`);
  };

  const saveQRCodeAsPNG = async (dataURL) => {
    try {
      // Convert Data URL to PNG file
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
      const fileUri = FileSystem.documentDirectory + "qrcode.png";

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log("QR Code saved to", fileUri);
      return fileUri;
    } catch (error) {
      console.error("Error saving QR Code:", error);
    }
  };

  const handleQRCodeRef = async () => {
    return new Promise((resolve) => {
      if (qrCodeRef.current) {
        qrCodeRef.current.toDataURL(async (dataURL) => {
          const fileUri = await saveQRCodeAsPNG(dataURL);
          if (fileUri) {
            // Manipulate the image
            const imageManipulationResult =
              await ImageManipulator.manipulateAsync(
                fileUri,
                [
                  {
                    resize: {
                      width: imageDimensions.width,
                      height: imageDimensions.height,
                    },
                  },
                ],
                { format: ImageManipulator.SaveFormat.PNG }
              );
            resolve(imageManipulationResult.uri);
          } else {
            resolve(null); // Handle error or null case
          }
        });
      } else {
        resolve(null); // Handle case where ref is not set
      }
    });
  };

  const compareImagesRedChannelOnly = async (imagePixels1, imagePixels2) => {
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

  if (hasPermission === null) {
    return <Text>Requesting camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <ScrollView>
      <TextInput
        placeholder="Enter message"
        value={message}
        onChangeText={(text) => setMessage(text)}
      />
      <Button title="Select Image" onPress={selectImage} />

      {imageUri && (
        <Image source={{ uri: imageUri }} style={{ width: 200, height: 200 }} />
      )}

      {image && (
        <Image
          source={{ uri: image }}
          style={{
            width: 200,
            height: 200,
            borderWidth: 2,
            borderColor: "red",
          }}
        />
      )}

      {/* QRCode component to create QR code with the same size as image */}
      {imageUri && message && (
        <QRCode
          value={message}
          size={300} // Ensure the QR code is square
          // getRef={(c) => (qrCodeRef.current = c)}
          getRef={(ref) => {
            qrCodeRef.current = ref;
          }}
          // getRef={handleQRCodeRef}
        />
      )}

      {fileUri && (
        <Image
          source={{ uri: fileUri }}
          style={{
            width: 200,
            height: 200,
            borderWidth: 2,
            borderColor: "red",
          }}
        />
      )}
      <Button
        title="Encode Image with QR Code"
        onPress={async () => {
          // const qrCodeData = await generateQRCode();
          await embedQRCodeInImageOnServer();
        }}
      />

      <Button title="Decode Image" onPress={extractQRCodeFromImage} />

      {qrCodeUri && (
        <View>
          <Text>Reconstructed QR Code:</Text>
          <Image
            source={{ uri: qrCodeUri }}
            style={{ width: 256, height: 256 }}
          />
        </View>
      )}

      {decodedMessage && (
        <View>
          <Text>Decoded Message from QR Code:</Text>
          <Text>{decodedMessage}</Text>
        </View>
      )}

      {
        scanned ? (
          <Button
            title={"Tap to Scan Again"}
            onPress={() => setScanned(false)}
          />
        ) : null
        // <BarCodeScanner
        //   onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        //   style={{ width: 300, height: 300 }}
        // />
      }
    </ScrollView>
  );
};

export default App;
