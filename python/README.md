# Python backend

Implementation is based on https://github.com/apollosense/megumi-meme-generator

A live version of this is available at https://apex.moe/api/megumi

```bash
curl -X POST https://apex.moe/api/megumi \
  -H "Content-Type: application/json" \
  -d '{"text": "HELL YEAH", "size": 11, "wrap": true, "uppercase": true, "colour": "#73B5FF", "glow_intensity": 100, "glow_colour": "#0033FF"}' \
  --output megumi.png
```

## Requirements
- Python
- Pillow (`pip install pillow`)

*Ensure `image.png` and `TikTokSans-900.ttf` are present in the in the same directory.*

