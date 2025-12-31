# Obsidian VOSS CLI Helper

An Obsidian plugin that provides intelligent autocompletion for VOSS (VSP) CLI commands. 

Turn your Obsidian notes into a powerful networking CLI editor.

## Features

- **Context-aware Autocompletion**: Suggests the next valid keyword based on what you've already typed.
- **Offline Support**: The full command database is embedded in the plugin.
- **Syntax Highlighting**: (Coming soon)

## Installation

### From GitHub (Manual)

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2. Create a folder `obsidian-voss-cli` in your vault's `.obsidian/plugins/` directory.
3. Place the files there.
4. Enable the plugin in Obsidian settings.

### Development

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to compile the plugin.
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault.

## Contributing

The command definitions are generated from JSON inputs.

## License

MIT
