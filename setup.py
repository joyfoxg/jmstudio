from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="joy-markdown-studio",
    version="3.9.13",
    author="Joy Fox",
    author_email="joyfoxg@gmail.com",
    description="The Ultimate Science & Engineering Research and Academic Markdown Editing & Visualization Studio",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/joyfoxg/jmstudio",
    py_modules=["jmstudio", "main", "app_config", "api_bridge", "routes", "gdrive_sync"],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.10",
    install_requires=[
        "bottle>=0.12.25",
        "pywebview>=4.4.1",
        "Pillow>=10.0.0",
        "google-api-python-client>=2.0.0",
        "google-auth-oauthlib>=1.0.0",
        "google-auth-httplib2>=0.1.0",
    ],
    entry_points={
        "gui_scripts": [
            "jmstudio=jmstudio:main",
        ],
    },
    include_package_data=True,
)
