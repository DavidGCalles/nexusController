"""Compatibility shim to run the server via the package entry point.

Prefer the CLI: `nexus-server` (installed from package) or
`from nexuscontroller.server import run`.
"""

from nexuscontroller.server import run

if __name__ == "__main__":
    run()