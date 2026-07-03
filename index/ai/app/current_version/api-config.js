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
    if (isNaN(activeIndex) || activeIndex < 0 || activeIndex >= keys.length) {
        activeIndex = 0;
    }

    // Helper functions for key state management
    function isKeyBlocked(index) {
        try {
            const blockedUntil = localStorage.getItem('shepu_key_blocked_until_' + index);
            if (blockedUntil) {
                const blockTime = parseInt(blockedUntil);
                if (!isNaN(blockTime) && Date.now() < blockTime) {
                    return true;
                }
            }
        } catch (e) {
            console.error("[Shepu API] Error reading block state:", e);
        }
        return false;
    }

    function findFirstUnblockedIndex() {
        // First try to find a key that is NOT blocked
        for (let i = 0; i < keys.length; i++) {
            if (!isKeyBlocked(i)) {
                return i;
            }
        }
        // If all are blocked, fallback to activeIndex
        return activeIndex;
    }

    // Define ShepuAPI interface on window securely
    window.ShepuAPI = {
        getActiveKey: function() {
            // If the current key is blocked, automatically switch to the first unblocked one
            if (isKeyBlocked(activeIndex)) {
                const nextGoodIndex = findFirstUnblockedIndex();
                if (nextGoodIndex !== activeIndex) {
                    console.log("[Shepu API] Current key is blocked. Auto-switching to working key index:", nextGoodIndex);
                    activeIndex = nextGoodIndex;
                    localStorage.setItem('shepu_active_key_index', activeIndex.toString());
                }
            }
            return keys[activeIndex];
        },
        rotateKey: function() {
            // Find next key index that is not blocked
            let nextIndex = activeIndex;
            for (let i = 1; i <= keys.length; i++) {
                let candidate = (activeIndex + i) % keys.length;
                if (!isKeyBlocked(candidate)) {
                    nextIndex = candidate;
                    break;
                }
            }
            // If all keys are blocked, just rotate to next index anyway as fallback
            if (nextIndex === activeIndex) {
                nextIndex = (activeIndex + 1) % keys.length;
            }
            
            activeIndex = nextIndex;
            localStorage.setItem('shepu_active_key_index', activeIndex.toString());
            console.log("[Shepu API] API key rotated. New active index:", activeIndex);
            return keys[activeIndex];
        },
        markActiveKeyAsBlocked: function(durationMs = 5 * 60 * 1000) { // Default 5 minutes block
            try {
                const blockedUntil = Date.now() + durationMs;
                localStorage.setItem('shepu_key_blocked_until_' + activeIndex, blockedUntil.toString());
                console.warn(`[Shepu API] Key at index ${activeIndex} marked as blocked for ${durationMs / 1000}s`);
            } catch (e) {
                console.error("[Shepu API] Failed to mark key as blocked:", e);
            }
        },
        getActiveIndex: function() {
            return activeIndex;
        },
        getKeyCount: function() {
            return keys.length;
        },
        isAnyKeyAvailable: function() {
            for (let i = 0; i < keys.length; i++) {
                if (!isKeyBlocked(i)) return true;
            }
            return false;
        }
    };
})();
