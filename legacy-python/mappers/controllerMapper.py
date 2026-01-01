"""Shim to use the mapper from the package namespace.

Run `python -m mappers.controllerMapper` or use the package entry points.
"""

from nexuscontroller.mappers.controllerMapper import run

if __name__ == "__main__":
    run()