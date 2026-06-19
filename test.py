from PIL import Image
import os

def apply_minecraft_water_tint(input_filename, output_filename, hex_tint="#3F76E4"):
    """
    Applies the default Minecraft biome tint to a grayscale water spritesheet.
    """
    if not os.path.exists(input_filename):
        print(f"Error: Could not find '{input_filename}'. Please ensure it is in the same directory.")
        return

    # 1. Parse the target Hex color into RGB integers
    hex_tint = hex_tint.lstrip('#')
    tint_r, tint_g, tint_b = tuple(int(hex_tint[i:i+2], 16) for i in (0, 2, 4))

    # 2. Open the image and convert to RGBA to preserve transparency
    try:
        img = Image.open(input_filename).convert("RGBA")
    except Exception as e:
        print(f"Error loading image: {e}")
        return

    pixels = img.load()
    width, height = img.size

    # 3. Process each pixel
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Skip fully transparent pixels to save processing time
            if a > 0:
                # Since the source is grayscale, R = G = B. 
                # We normalize the intensity to a float between 0.0 and 1.0.
                intensity = r / 255.0

                # Multiply the intensity by the specific biome tint
                new_r = int(intensity * tint_r)
                new_g = int(intensity * tint_g)
                new_b = int(intensity * tint_b)

                # Reassign the newly calculated pixel
                pixels[x, y] = (new_r, new_g, new_b, a)

    # 4. Save the result
    img.save(output_filename)
    print(f"Success! Tinted spritesheet saved as: {output_filename}")

if __name__ == "__main__":
    # Place your 'water_still.png' in the same folder as this script
    INPUT_FILE = "water_still.png"
    OUTPUT_FILE = "water_still_colored.png"
    
    apply_minecraft_water_tint(INPUT_FILE, OUTPUT_FILE)