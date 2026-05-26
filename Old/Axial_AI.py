from typing import Tuple
import math
import random
from numba import njit
import numpy as np


@njit
def test():
    return np.sum(np.arange(1000000))

print(test())