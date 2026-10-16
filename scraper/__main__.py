"""CLI entry point: ``python -m scraper [--only kaggle zindi] [--verbose]``."""
from __future__ import annotations

import argparse
import logging
import sys

from .pipeline import run
from .sources import SOURCE_MODULES


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Aggregate active ML competitions into data/competitions.{json,csv}")
    parser.add_argument("--only", nargs="+", choices=SOURCE_MODULES, help="run only these sources")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    for noisy in ("urllib3", "kagglesdk", "kaggle"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    run(only=args.only)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

