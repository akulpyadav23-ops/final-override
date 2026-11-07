// Decoding tools for Stage 2

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

function base64Decode(str) {
  const clean = str.trim().replace(/\s+/g, '');
  try {
    return atob(clean);
  } catch {
    throw new Error('Invalid input for this decoder');
  }
}

function hexDecode(str) {
  const clean = str.trim().replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('Invalid input for this decoder');
  }
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

window.decoderTools = {
  rot13,
  base64Decode,
  hexDecode
};
