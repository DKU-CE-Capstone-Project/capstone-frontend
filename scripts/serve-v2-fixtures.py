"""Run the HTTP v2 UI fixture; no DB, external API, or real generation."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'mock-api'))
from v2 import main

if __name__ == '__main__':
    main(default_port=9036)
