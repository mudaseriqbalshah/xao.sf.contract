import qrcode

# Create QR code instance
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)

# Add data
qr.add_data('https://xao.fun')
qr.make(fit=True)

# Create an image from the QR Code
qr_image = qr.make_image(fill_color="black", back_color="white")

# Save it
qr_image.save('attached_assets/xao_qr.png')
