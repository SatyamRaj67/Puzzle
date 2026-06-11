from PIL import Image

def tint_minecraft_grass(image_path, output_path, tint_rgb=(145, 189, 89)):
    """
    Tints a grayscale Minecraft grass texture into a specific biome color 
    while perfectly preserving the alpha transparency.
    """
    r_tint, g_tint, b_tint = tint_rgb
    print(f"Applying Grass Tint (RGB): {r_tint}, {g_tint}, {b_tint}")

    try:
        # Open the image and ensure it has an Alpha channel (RGBA)
        img = Image.open(image_path).convert("RGBA")
    except FileNotFoundError:
        print(f"Error: Could not find '{image_path}'.")
        return

    # Create a new image for the tinted output
    tinted_img = Image.new("RGBA", img.size)
    pixels = img.load()
    tinted_pixels = tinted_img.load()

    # Apply the Multiply Blend Mode
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            
            # If the pixel is fully transparent, skip the math and just copy it
            if a == 0:
                tinted_pixels[x, y] = (0, 0, 0, 0)
                continue
            
            # Multiply the grayscale base by the normalized tint color
            # We use 'r' as the baseline since it's a grayscale image (r = g = b)
            new_r = int(r * (r_tint / 255.0))
            new_g = int(g * (g_tint / 255.0))
            new_b = int(b * (b_tint / 255.0))
            
            # Write the new color to the output image, preserving the alpha
            tinted_pixels[x, y] = (new_r, new_g, new_b, a)

    # Save the final tinted texture
    tinted_img.save(output_path)
    print(f"Success! Saved tinted grass texture to {output_path}")

if __name__ == "__main__":
    # Your uploaded filename
    INPUT_IMAGE = "grass.png" 
    OUTPUT_IMAGE = "image.png"
    
    # Biome Color Guide:
    # Plains: (145, 189, 89)
    # Forest: (121, 192, 90)
    # Jungle: (89, 201, 60)
    # Savanna: (191, 183, 85)
    
    # Running with the default Plains biome green
    tint_minecraft_grass(INPUT_IMAGE, OUTPUT_IMAGE)