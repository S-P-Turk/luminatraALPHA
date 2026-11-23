// Excludes visually ambiguous characters (0/O, 1/I/L) so codes are easy to
// read aloud or copy off a whiteboard.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
