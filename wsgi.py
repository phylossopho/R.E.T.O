"""Punto de entrada WSGI para alojamientos como PythonAnywhere."""

import os
import sys

PROJECT_HOME = os.path.dirname(os.path.abspath(__file__))
if PROJECT_HOME not in sys.path:
    sys.path.insert(0, PROJECT_HOME)

from server import app as application