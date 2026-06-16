with open('ph_schools_04282026.sqlite', 'rb') as f:
    header = f.read(100)
    print("Header bytes:", header)
    print("Header text:", header.decode('utf-8', errors='ignore'))
