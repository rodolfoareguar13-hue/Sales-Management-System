Sales Management System – Salvadoran Pupusería

A fast, reliable, and efficient sales management system designed specifically for a Salvadoran pupusería. The system provides streamlined sales registration, comprehensive reporting, weekly sales targets, and PDF/Excel export capabilities.

Features

Fast sales entry with product autocomplete

Reliable local SQLite database

Sales reports with date and payment-method filters

Weekly sales targets with visual progress tracking

Daily sales charts

PDF and Excel report exports

Simple, user-friendly web interface

Windows .exe installer for easy deployment

Installation and Usage
Development Environment

Install the project dependencies:

npm install


Start the application in development mode:

npm start

Building the Windows Installer

To generate the Windows installer, run:

npm run build-win


The resulting .exe installer will be generated in the dist/ directory.

Project Structure
├── main.js                  # Electron main process
├── preload.js               # Electron preload script
├── package.json             # Project configuration
├── server/
│   ├── database.js          # SQLite database configuration
│   ├── routes.js            # API routes
│   ├── pdfGenerator.js      # PDF report generator
│   └── excelGenerator.js    # Excel report generator
├── public/
│   ├── index.html            # Main user interface
│   ├── styles.css            # Application styles
│   └── app.js                # Frontend application logic
└── data/                     # SQLite database (created automatically)

Core Functionality
Sales Registration

Quick product search with autocomplete

Add multiple products and quantities to a sale

Supported payment methods:

Cash

Credit/Debit Card

Simple Móvil

Optional sales notes and observations

Sales Reports

Filter reports by date range and payment method

View total sales and transaction counts

Export sales reports to PDF and Excel

Weekly Sales Targets

Configurable weekly sales target

Default weekly target: ₡600,000

Visual progress bar for target tracking

Daily sales chart for the current week

Exportable weekly target reports

Database

The SQLite database is automatically created at:

data/ventas.db


The database contains the following tables:

productos – Product catalog

ventas – Sales transactions

venta_items – Individual items associated with each sale

metas – Weekly sales target configuration

Additional Notes

The initial product catalog is automatically loaded when the application is launched for the first time.

Weekly sales targets are calculated from Monday through Sunday.

All product prices include VAT (I.V.A.).

Building the Windows Installer

To compile the native sqlite3 module and generate the Windows installer, the required Visual Studio C++ build tools must be installed.

1. Install Visual Studio Build Tools 2022

Open the Visual Studio Installer and install Visual Studio Build Tools 2022.

Select the following workload:

Desktop development with C++

Make sure the following components are installed:

MSVC v143 – VS 2022 C++ x64/x86 build tools

Windows 11 SDK (10.0.22621) or Windows 10 SDK (10.0.19041)

C++ CMake tools for Windows (optional, but recommended)

2. Install Python Pip and Setuptools

node-gyp requires Python and the appropriate build tooling. Run the following commands in PowerShell:

python -m ensurepip --upgrade
python -m pip install --upgrade pip setuptools

3. Use the Native Visual Studio Tools Command Prompt

Open:

x64 Native Tools Command Prompt for VS 2022

The Build Tools version of the command prompt is recommended.

Navigate to the project directory:

cd C:\Users\pupus\Desktop\Pupuseria

4. Rebuild the SQLite Module

Force a native rebuild of the sqlite3 dependency:

npm rebuild sqlite3

5. Generate the Windows Installer

Once the native dependencies have been successfully rebuilt, run:

npm run build-win


The installer will be generated in the dist/ directory.

The expected installer filename is:

Sistema de Ventas - Pupusería Setup 1.0.0.exe

Troubleshooting
"Cannot create symbolic link"

Run the command prompt as Administrator, or enable Developer Mode in Windows.

distutils Errors

Verify that Python and its packaging tools are properly installed. Run:

python -m ensurepip --upgrade
python -m pip install --upgrade pip setuptools

Windows SDK Errors

Open the Visual Studio Installer and confirm that at least one compatible Windows SDK is installed and selected under the C++ desktop development workload.

Deployment

After a successful build, the Windows installer will be available in the project's dist/ directory and can be distributed to the pupusería's Windows computers for installation.

The application uses a local SQLite database, allowing sales data to be stored reliably on the local machine without requiring an external database server.
