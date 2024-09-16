import { Platform } from "react-native";

interface ImageUploadResponse {
  message: string;
}

// Function to encode a message into an image
export async function encodeMessageIntoImage(
  imageUri: string,
  message: string
): Promise<string | null> {
  const formData = new FormData();
  const fileType = imageUri.split(".").pop();

  formData.append("message", message);
  formData.append("image", {
    uri: Platform.OS === "android" ? imageUri : imageUri.replace("file://", ""),
    type: `image/${fileType}`,
    name: `image.${fileType}`,
  } as unknown as Blob);

  try {
    console.log("sending to server", message);
    const response = await fetch("https://encrypt-python.onrender.com/encode", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    if (response.ok) {
      const encodedImageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(encodedImageBlob); // Web usage
      return imageUrl;
    } else {
      throw new Error("Error encoding the image");
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// Function to decode the QR code from an image
export async function decodeMessageFromImage(
  imageUri: string
): Promise<string | null> {
  const formData = new FormData();
  const fileType = imageUri.split(".").pop();

  formData.append("image", {
    uri: Platform.OS === "android" ? imageUri : imageUri.replace("file://", ""),
    type: `image/${fileType}`,
    name: `image.${fileType}`,
  } as unknown as Blob);

  try {
    console.log("sending to server");
    const response = await fetch("http://172.20.10.2:5000/decode", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    if (response.ok) {
      const jsonResponse: ImageUploadResponse = await response.json();
      return jsonResponse.message;
    } else {
      throw new Error("Error decoding the image");
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
