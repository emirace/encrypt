import React, { useState, useEffect } from "react";
import { View, Image, Text, ScrollView } from "react-native";
import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Camera } from "expo-camera";
import jsQR from "jsqr";
import jpeg from "jpeg-js";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Portal,
  Modal,
} from "react-native-paper";

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

const App = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [qrCodeUri, setQrCodeUri] = useState(null);
  const [decodedMessage, setDecodedMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // 4. Extract Image Pixels
  const extractImagePixels = async (uri) => {
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binaryData = Buffer.from(base64Data, "base64");
    const decodedImage = jpeg.decode(binaryData);
    return decodedImage.data;
  };

  // 7. Decode the QR Code from the Image
  const extractQRCodeFromImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;
    setLoading(true);
    const { uri, width, height } = result.assets[0];

    console.log("hello5");

    console.log("encoded image path", uri);
    const imagePixels = await extractImagePixels(uri);
    const qrCodePixels = await extractLSB(imagePixels, width, height);
    console.log(imagePixels.slice(0, 30));
    // console.log(qrCodePixels.slice(0,30));
    console.log("hello7");
    console.log("return pixels length:", qrCodePixels.length);
    console.log(qrCodePixels.slice(0, 30));

    const encodedImage = jpeg.encode(
      {
        data: qrCodePixels,
        width,
        height,
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
    const message = extractMessageFromQRCode(qrCodePixels, width, height);
    setDecodedMessage(message);
    setLoading(false);
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

  if (hasPermission === null) {
    return <Text>Requesting camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => {}} />
        <Appbar.Content title="Decode" />
      </Appbar.Header>
      <ScrollView
        style={{ padding: 20 }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Button mode="contained" onPress={extractQRCodeFromImage}>
          Decode Image
        </Button>

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
          <View style={{ marginTop: 30 }}>
            <Text>Decoded Message from QR Code:</Text>
            <Text>{decodedMessage}</Text>
          </View>
        )}
        <Portal>
          <Modal
            visible={loading}
            contentContainerStyle={{
              padding: 20,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
            }}
          >
            <Text style={{ marginBottom: 20 }}>Decoding message...</Text>
            <ActivityIndicator size={"large"} />
          </Modal>
        </Portal>
      </ScrollView>
    </>
  );
};

export default App;
