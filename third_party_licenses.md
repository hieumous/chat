# Third-Party Licenses

This document contains the license information for all third-party libraries used in the Self-Assessment System project.

---

## Python Standard Library (tkinter, json, os, sys, etc.)
**License**: Python Software Foundation License (PSF)
**Website**: https://www.python.org/psf/license/

The Python Software Foundation License is compatible with the MIT License.

---

## NumPy
**License**: BSD 3-Clause License
**Website**: https://numpy.org/doc/stable/license.html
**Copyright**: Copyright (c) 2005-2023, NumPy Developers

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the NumPy Developers nor the names of any contributors may be used to endorse or promote products derived from this software without specific prior written permission.

---

## Pandas
**License**: BSD 3-Clause License
**Website**: https://pandas.pydata.org/pandas-docs/stable/getting_started/overview.html#license
**Copyright**: Copyright (c) 2008-2011, AQR Capital Management, LLC, Lambda Foundry, Inc. and PyData Development Team

Same BSD 3-Clause License terms as NumPy apply.

---

## Matplotlib
**License**: PSF-based License (similar to Python Software Foundation License)
**Website**: https://matplotlib.org/stable/users/project/license.html
**Copyright**: Copyright (c) 2002-2004 John D. Hunter; All Rights Reserved

The matplotlib license is based on the Python Software Foundation (PSF) license.

---

## Plotly
**License**: MIT License
**Website**: https://github.com/plotly/plotly.py/blob/master/LICENSE.txt
**Copyright**: Copyright (c) 2016-2018 Plotly, Inc

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

---

## Pillow (PIL Fork)
**License**: PIL License (PIL Software License)
**Website**: https://pillow.readthedocs.io/en/stable/about.html#license
**Copyright**: Copyright (c) 1997-2011 by Secret Labs AB, Copyright (c) 1995-2011 by Fredrik Lundh

The PIL Software License permits use, copying, modification, and distribution.

---

## Python-dateutil
**License**: BSD 3-Clause License / Apache 2.0 License (Dual License)
**Website**: https://github.com/dateutil/dateutil/blob/master/LICENSE
**Copyright**: Copyright 2017- Paul Ganssle, Copyright 2017- dateutil contributors

---

## Streamlit (if used for web interface)
**License**: Apache License 2.0
**Website**: https://github.com/streamlit/streamlit/blob/develop/LICENSE
**Copyright**: Copyright 2018-2022 Streamlit Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

---

## Flask (if used for web interface)
**License**: BSD 3-Clause License
**Website**: https://flask.palletsprojects.com/en/2.3.x/license/
**Copyright**: Copyright 2010 Pallets

---

## Seaborn (if used for additional plotting)
**License**: BSD 3-Clause License
**Website**: https://github.com/mwaskom/seaborn/blob/master/LICENSE
**Copyright**: Copyright (c) 2012-2023, Michael L. Waskom

---

## Scikit-learn (if used for advanced analytics)
**License**: BSD 3-Clause License
**Website**: https://github.com/scikit-learn/scikit-learn/blob/main/COPYING
**Copyright**: Copyright (c) 2007-2023 The scikit-learn developers

---

## Additional Notes

### License Compatibility
All third-party licenses used in this project are compatible with the MIT License under which this project is distributed.

### License Texts
Full license texts for each third-party library can be found in their respective repositories or documentation. The information above provides attribution and key license terms.

### Updates
This file should be updated whenever new third-party dependencies are added to the project.

### Verification
To verify the licenses of installed packages, run:
```bash
pip-licenses --format=markdown --output-file=current_licenses.md
```

---

**Last Updated**: May 2025
**Maintained by**: Self-Assessment System Project Team