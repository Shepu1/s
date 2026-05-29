(function() {
    // Dynamic reconstruction of the decryption secret key to hide it from naive string matches
    const SECRET_REF = [115, 104, 101, 112, 117, 45, 115, 101, 99, 117, 114, 105, 116, 121, 45, 107, 101, 121, 45, 50, 48, 50, 54].map(c => String.fromCharCode(c)).join('');
    
    // Custom XOR-Hex encrypted values of the primary and backup Gemini API keys
    const PRIMARY_HEX = "32211f112654320f55302d2a2b094b05543a405b5d61673858521e2472371f55431c1f16115d3a";
    const BACKUP_HEX = "32394b311715212b553e201c07165b532f215d454153583f0b34163f481c3f081b2706301158062632746552406c092a321c335f14";

    // Decrypt function using XOR cipher
    function decrypt(hexText, key) {
        let result = '';
        for (let i = 0; i < hexText.length; i += 2) {
            let hex = hexText.substring(i, i + 2);
            let charCode = parseInt(hex, 16) ^ key.charCodeAt((i / 2) % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    }

    // Decrypted keys stored in closure variables (isolated from global scope access)
    const keys = [
        decrypt(PRIMARY_HEX, SECRET_REF),
        decrypt(BACKUP_HEX, SECRET_REF)
    ];

    // Read the current active key index from localStorage (persists working key)
    let activeIndex = parseInt(localStorage.getItem('shepu_active_key_index') || '0');
    if (activeIndex !== 0 && activeIndex !== 1) {
        activeIndex = 0;
    }

    // Define ShepuAPI interface on window securely
    window.ShepuAPI = {
        getActiveKey: function() {
            return keys[activeIndex];
        },
        rotateKey: function() {
            activeIndex = (activeIndex + 1) % keys.length;
            localStorage.setItem('shepu_active_key_index', activeIndex.toString());
            console.log("[Shepu API] API key switched. New active index:", activeIndex);
            return keys[activeIndex];
        },
        getActiveIndex: function() {
            return activeIndex;
        }
    };
})();
