// Loads keys for the eval scripts from .env.local (gitignored), so the
// Anthropic key never has to be exported in the terminal. Exporting it there
// makes Claude Code ask whether to use it instead of your claude.ai login.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
