import { useLocation } from "react-router";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useEffect, useState } from "react";


function Invoice() {
    const location = useLocation();
    const formData = location.state || {};

    const [invoiceNumber, setInvoiceNumber] = useState(1);

    useEffect(() => {
        const lastNumber = localStorage.getItem("lastInvoiceNumber");
        setInvoiceNumber(lastNumber ? parseInt(lastNumber) : 1);
    }, []);

    // Save new invoice number to localStorage
    const saveInvoiceNumber = (num) => {
        setInvoiceNumber(num);
        localStorage.setItem("lastInvoiceNumber", num);
    };

    // Manual increment/decrement
    const incrementInvoiceNumber = () => saveInvoiceNumber(invoiceNumber + 1);
    const decrementInvoiceNumber = () => {
        if (invoiceNumber > 1) saveInvoiceNumber(invoiceNumber - 1);
    };

    const downloadPDF = async () => {
        const element = document.getElementById("invoice-content");
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const pdf = new jsPDF("p", "mm", "a4");
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, 210, (canvas.height * 210) / canvas.width);

        try {
        if ("showSaveFilePicker" in window) {
            // ✅ Use File System Access API if supported
            const handle = await window.showSaveFilePicker({
            suggestedName: `invoice_${invoiceNumber + "-" + formData.invoiceDate}.pdf`,
            types: [
                {
                description: "PDF Files",
                accept: { "application/pdf": [".pdf"] },
                },
            ],
            });

            const writable = await handle.createWritable();
            const pdfBlob = pdf.output("blob");
            await writable.write(pdfBlob);
            await writable.close();

            // Increment only if actually saved
            incrementInvoiceNumber();
        } else {
            // 🔄 Fallback for browsers without File System Access API
            pdf.save(`invoice_${invoiceNumber + "-" + formData.invoiceDate}.pdf`);
            // User must manually adjust number if needed
        }
        } catch (error) {
        if (error.name !== "AbortError") console.error("Error saving PDF:", error);
        // No increment on cancel or error
        }
    };
 
    return ( 
        <div className="bg-gray-100">
            <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 pt-2">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={decrementInvoiceNumber}
                        className="px-3 py-1 bg-gray-300 text-black rounded hover:bg-gray-400"
                    >
                        –
                    </button>

                    <span className="font-semibold text-lg text-gray-800">
                        Invoice No: #{invoiceNumber}
                    </span>

                    <button
                        onClick={incrementInvoiceNumber}
                        className="px-3 py-1 bg-gray-300 text-black rounded hover:bg-gray-400"
                    >
                        +
                    </button>
                </div>

                <button
                    onClick={downloadPDF}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Download PDF
                </button>
            </div>  

            <div id="invoice-content" className="max-w-4xl h-screen mx-auto bg-white p-8 rounded-lg shadow-md text-sm grid grid-cols-6 gap-4">
                <table className="w-full table-auto border-separate border-spacing-y-4 col-start-1 col-end-7 ">
                    <tbody>
                        <tr colSpan={6} className="align-top">
                            <td className="w-1/2 text-left align-top">
                                <div className="text-gray-700 space-y-1">
                                    <p><strong>Invoice Date:</strong> { formData.invoiceDate }</p>
                                </div>
                            </td>

                            <td className="pr-4 relative">
                                <p className="text-red-500">#{invoiceNumber}</p>
                                <img
                                    src="data:image/png;base64,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"
                                    alt="Logo"
                                    className="mb-2 w-24 h-24 object-contain absolute right-0"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={6}>
                                <table className="min-w-full text-left border border-amber-100 mt-6">
                                    <thead className="bg-blue-100 text-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 border border-gray-400">Item Description</th>
                                            <th className="px-4 py-2 border border-gray-400">Qty</th>
                                            <th className="px-4 py-2 border border-gray-400">Rate</th>
                                            <th className="px-4 py-2 border border-gray-400">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.map((i, idx) => (
                                            <tr className="text-black" key={idx}>
                                                <td className="border border-gray-400 px-4 py-2">{i.item}</td>
                                                <td className="border border-gray-400 px-4 py-2">{i.quantity}</td>
                                                <td className="border border-gray-400 px-4 py-2">{i.rate}</td>
                                                <td className="border border-gray-400 px-4 py-2">{i.quantity * i.rate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td colSpan={3} className="text-center text-black">
                                <div className="mt-4">
                                    <img
                                        src={formData.signature}
                                        alt="Signature"
                                        className="mb-2 w-[200px] h-[60px] object-contain"
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={6}>
                                <div className="mt-8 text-gray-600">
                                    <h4 className="font-semibold mb-1">Terms & Conditions</h4>
                                    <p>
                                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div> );
}

export default Invoice;