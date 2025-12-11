import { useLocation } from "react-router";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useEffect, useState } from "react";


function ProofOfDelivery() {
    const location = useLocation();
    const formData = location.state || {};

    const [podNumber, setPodNumber] = useState(33800);
    const [busy, setBusy] = useState(false);
    const [reservation, setReservation] = useState(null); // holds server reservation row

    // Convert date to locale string
    const formattedDate = formData.date ? new Date(formData.date).toLocaleDateString() : "";

    useEffect(() => {
        const lastNumber = localStorage.getItem("lastPodNumber");
        setPodNumber(lastNumber ? parseInt(lastNumber, 10) : 33800);
    }, []);

    // Save new POD number to localStorage
    const savePodNumber = (num) => {
        setPodNumber(num);
        localStorage.setItem("lastPodNumber", num);
    };
    const BASE = "https://invoice-pdf-sepia.vercel.app"; // relative URLs work on Vercel; override if needed

    async function reservePodApi(reserved_by = null, metadata = {}) {
        const res = await fetch(`${BASE}/api/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserved_by, metadata }),
        });
        if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(`Reserve failed: ${res.status} ${txt || ""}`);
        }
        const data = await res.json();
        // Supabase RPC often returns array; normalize to single object
        return Array.isArray(data) ? data[0] : data;
    }

    async function confirmPodApi(reservation_id) {
        const res = await fetch(`${BASE}/api/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id }),
        });
        if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(`Confirm failed: ${res.status} ${txt || ""}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data[0] : data;
    }

    async function releasePodApi(reservation_id) {
        const res = await fetch(`${BASE}/api/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id }),
        });
        if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(`Release failed: ${res.status} ${txt || ""}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data[0] : data;
    }

    // Manual increment/decrement
    const incrementPodNumber = () => savePodNumber(podNumber + 1);

    const handleSharePdf = async () => {
        setBusy(true);
        let localReservation = reservation;

        // driverId source — adapt as needed
        const driverId = localStorage.getItem("driverId") || "unknown-driver";

        try {
        // 1) Reserve if we don't already have a reservation
        if (!localReservation) {
            const res = await reservePodApi(driverId, { orderNo: formData.orderNo });
            localReservation = res;
            setReservation(localReservation);

            // normalize returned fields (some RPCs might return camelCase or snake_case)
            const pod_number = localReservation.pod_number ?? localReservation.podNumber ?? localReservation.podNumber;
            if (!pod_number && pod_number !== 0) {
            throw new Error("Server did not return pod_number");
            }
            setPodNumber(Number(pod_number));
            // wait a tick so DOM updates show the pod number before capture
            await new Promise((r) => setTimeout(r, 80));
        }

        // 2) Generate PDF blob
        const pdfBlob = await generatePdfBlob(localReservation.pod_number ?? localReservation.podNumber ?? podNumber);
        if (!pdfBlob) {
            // release reservation if generation failed
            await releasePodApi(localReservation.reservation_id).catch(()=>{});
            throw new Error("PDF generation failed");
        }

        // 3) Create file & attempt native share
        const fileName = buildPodFileName(localReservation.pod_number ?? localReservation.podNumber ?? podNumber);
        const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf", lastModified: Date.now() });

        // If native share with files supported, use it (preferred)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
            title: `Proof of Delivery`,
            text: `POD ${localReservation.pod_number ?? podNumber}`,
            files: [pdfFile],
            });

            // 4) Confirm reservation after successful share
            await confirmPodApi(localReservation.reservation_id);
            // Persist as last used pod number
            savePodNumber(localReservation.pod_number ?? podNumber);

            // cleanup local reservation state
            setReservation(null);
            alert("POD shared and confirmed.");
        } else {
            // Fallback: force a download (still mark as confirmed so number is consumed)
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            // Confirm the reservation server-side (we consumed the POD by downloading it)
            await confirmPodApi(localReservation.reservation_id);
            savePodNumber(localReservation.pod_number ?? podNumber);
            setReservation(null);
            alert("POD downloaded and confirmed.");
        }
        } catch (err) {
        console.error("Share flow error:", err);
        // If we had a reservation and it's still reserved, release it so another device can take the number
        if (localReservation?.reservation_id) {
            try {
            await releasePodApi(localReservation.reservation_id);
            } catch (releaseErr) {
            console.warn("Release failed:", releaseErr);
            }
        }
        alert(err.message || "Unable to share POD.");
        } finally {
        setBusy(false);
        }
    };

    const generatePdfBlob = async (podNum) => {
        const element = document.getElementById("pod-content");
        if (!element) throw new Error("POD content element not found");

        // Ensure the pod number is visible in the DOM prior to capture (we set it earlier)
        // Render at moderate scale to keep file size reasonable
        const canvas = await html2canvas(element, {
        scale: Math.max(1.5, window.devicePixelRatio || 2),
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        });

        // Use JPEG inside PDF to keep size down and compatibility up
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const imgRatio = imgWidth / imgHeight;
        const pageRatio = pdfWidth / pdfHeight;

        let renderWidth, renderHeight, x, y;

        if (Math.abs(imgRatio - pageRatio) < 0.01) {
        renderWidth = pdfWidth;
        renderHeight = pdfHeight;
        x = 0;
        y = 0;
        } else if (imgRatio > pageRatio) {
        renderWidth = pdfWidth;
        renderHeight = pdfWidth / imgRatio;
        x = 0;
        y = (pdfHeight - renderHeight) / 2;
        } else {
        renderHeight = pdfHeight;
        renderWidth = pdfHeight * imgRatio;
        x = (pdfWidth - renderWidth) / 2;
        y = 0;
        }

        // Use JPEG image for smaller PDF sizes
        pdf.addImage(imgData, "JPEG", x, y, renderWidth, renderHeight);

        return pdf.output("blob");
    };

    const buildPodFileName = () => {
        // Prefer line 1, fallback to line 2
        const rawRecipient =
            formData.deliverToLine1?.trim() ||
            formData.deliverToLine2?.trim() ||
            "Unknown Recipient";

        // Format date as "10 November 2025"
        const dateObj = formData.date ? new Date(formData.date) : null;
        const formattedLongDate = dateObj
            ? dateObj.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
            })
            : "Unknown Date";

        return `POD ${podNumber} for ${rawRecipient} for ${formattedLongDate}.pdf`;
    };
 
    return ( 
        <div className="bg-gray-100 h-auto w-full">
            <div className="flex justify-center mb-4 pt-2">
                <button
                    onClick={handleSharePdf}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Share PDF
                </button>
            </div>  

            <div id="pod-content" className="bg-white px-8 py-14 rounded-lg shadow-md text-sm flex flex-col pod-a4">
                <p className="text-black text-center font-bold">DELIVERY NOTE <span className="absolute left-[60%] text-4xl font-bold text-red-500 whitespace-pre-wrap" style={{fontFamily: "SoftItalics" }}>N <span className="absolute left-[12%] bottom-[10%]">ọ</span> {podNumber}</span> </p>
                <div className="flex justify-between">
                    <table className="table-fixed w-80 h-16">
                        <thead className="w-64 text-black text-left text-xs">
                            <tr>
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-40 bg-blue-100">DATE</th>
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-24"> { formattedDate } </th>
                            </tr>
                            <tr >
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-40 bg-blue-100">ORDER NO</th>
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-24"> { formData.orderNo } </th>
                            </tr>
                        </thead>
                    </table>


                    <img
                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIoAAAB4CAMAAAAaA5pEAAAACXBIWXMAAAsTAAALEwEAmpwYAAADAFBMVEVHcEwPGzQbJVQkMG8PJz4ZKVUIDR0NJjoPHDYTKUkrO4gZI1ElMnMaJFEJFiUpOIAcJVcAdG4aKFYlM3YbI1QbL18ZIk8ZIU0oNnwbIlIeJ1wlMXIAaGMNLkIeJlwJEB8mMHQnMHYrPIofKWAmNHgAlI0LHC4tPo8eKF4Aa2YbJFUMESchK2YpOIMeJ10kMnIpNX8iMG0nNHkApp4cJlgAfHUSZI4qOYQrOYYTHD0iK2crN4QpMXksOokrPIoAcGooNHwqOYMTH0AAaWQoOIAAv7YAQj8sNIMoNn4rN4MkLm4YJU8hK2UApp4iLmorO4cAf3gtPo8dJ1wAR0QrNIEATksmL3ImNHgqNYAAYFsnNHoqO4YrOYcwQpgmMnYpOYMpOYIwQ5kAd3EAhH4Aw7kAl48AurAAdnAvPZAKDR8vQJURFDIgKmQrO4gArKQqO4cAmpIAoZkAmJAAkIkAXVkApp4AgnsAr6YAtKoAenQXHUcdJVkmMXQuPpAWHEUAfngdJ10AjYYoN38qOoUuP5IAq6IhK2UAQT4XJU4POE4xRJ0ASUUcJVcAv7UAmpIAsKcAjYUCVVcAo5sASkcqNH4iLmwoNX0lL3IAqqIgQHwsPYwBr6kASkYAsaghKmYsPo0AZ2IrO4cAoJggK2QAlo4DbnAAZmAGW2YAnZUAtawAq6IqNoATapYuPpAAfngyRZ4AoZkAqaEAcGoAp58vQZYAoJgAenQAtqwAubAAk4sAvLMAwrgApJ0AhX8ArqUAX1svN4sAc20pQYoSZ5MoOIEAs6oAiYIAioMTapcPZIkDg4EApJwoLnMRYYcpOYIpMHgpOYEoOIApMHcqO4cwQpgpOoQrPIoAoZkpOIEoL3UrPIguP5EqMnwsPYwtP48AqqIrMn8ApJwAnZUpMHkuQZQsNIMAsqkArqYAqKAAubAsPo4SY4wAoJgAn5cqMXouNogAtq0AysAnNnwQZo00SKYwOI0TXooAlY4rKXUAp54eTIcTZ5QLeZAGkZguTqIA29BVdOM2AAAA8nRSTlMAC0e2BiAbAQkDyn7XGhbqTRMo+xUPdje5U26WFxJmD6y93T3asyT2JAwtM3WWRG/CVYLDih79erQ7nvL16aIt56pCNqn/Xfi01lwdTel97kzVk2fuHM572yRqv+bwxvf71kBW/qLrl+gs+UeoxtDR7awse5DdgZG8zVxfiuNrOoGPzour+LdRMWnoSqDG48NuPPhC9DKdovJO++8u4YzuVfzPvsF2Rl2U6E/h/cCm+/C2hnS2YrnPqtT13YHPomj4Zv66/ve77umZtov80f///////////////////////////////////////////////lkcAa4AAA8MSURBVHja7Fp7TFTZGb8Dg8Moj8nwBoHhscACAwMhmeEZICYwSkQJAaK8bNMGFErapE0j4hJAQ4hJ04TFyG4wxuxuWzVuE5M2m/7hRv/Y7bZ37szlDvMWBOp2wKFBJa66Sb9zzr3zEFb8o3uHJn5/zT333Dm/+z1+33e+cynqfyD95dQekVhVhmSPQCleXS3eG0gKbjgctQl7Aopq0WRwhIbvASSHn5lMBtNGafCx5HSAUgzWVVXQochmEBKDo0oRdKUk5VoBiWnxnCzolKJxIKUstuUHXSmjz5BSDHuAVxJuICCG5YzYYCOR1DiQUpZb94DPNmDzeFKC7rM5Gmwekz5PGJFKgwQlfhVFj2na57PHguS++R1YJ4sX44SRqHtf/T4YSOTnsFKsrUXeoc9evvxaHoxAbl1GSFYrvMkn7N6TtZtXgqAUFVKK1ROt9A59cnNt7eY98T1XcReHj+eoN5Bzvnq5Blg+E10pGatWZJ4IH89+jZCs3fxnqtjsdhexm2c5zTvyq4+2ttbWnjx5kSYy5WOlmBYzvIEs/+WjVwjKFt0mbkJKwxnZ4xn2sdsX69+vbYFSnq8mi6qURFS7mRwq7/5H8ucH649fbT3Z2nzuEFUtZ4mntCZ5R7784uHC0vdP1l48N5gaRFRLnMqDiNZz2cshqb9bWl9YWH/1YvM5jPs86McPn2ZcHPgr5d8PFxZALS+eIwpuHRYLiVRN2M23DTv428eAZOG7v6swFI9KLMqt78TFQaWPQL78D1LKwh8/re/CTlQbIladsoiQeHyB8vFf1hGSpfcoaSjZFrWIg2RfowdBaTjgy4OPEJTHH/2Uos4TwukOEycRTuOSqcO72se/WAIk69++9z5FRe7HUKrOirI1bcf0tuqL5E8eLGClHEMXcxuAZXlxTozKO0qFXaXhsAAt59ffgn0ePkJKoaii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"
                        alt="Logo"
                        className="w-24 h-24 object-contain mt-[-30px]"
                    />
                </div>

                <br />

                <div className="flex gap-2">
                    <table className="table-fixed w-80 h-16 -mt-3.5">
                        <thead className="w-64 text-black text-left text-xs">
                            <tr>
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-20 bg-blue-100">ON BEHALF OF</th>
                                <td className="px-4 pt-2 pb-4 border border-gray-400 w-24"> { formData.onBehalf } </td>
                            </tr>
                            <tr>
                                <th className="px-4 pt-2 pb-4 border border-gray-400 w-20 bg-blue-100">INSTRUCTED BY</th>
                                <td className="px-4 pt-2 pb-4 border border-gray-400 w-24"> { formData.instructor } </td>
                            </tr>
                        </thead>
                    </table>

                    <div className="flex flex-col w-[60%] h-16">
                        <table className="-mt-3.5 table-fixed w-full">
                            <thead className="w-64 text-black text-left text-xs">
                                <tr>
                                    <th className="px-4 pt-2 pb-4 border border-gray-400 w-20 bg-blue-100 relative">DELIVER TO</th>
                                    <td className="px-4 pt-2 pb-4 border border-gray-400 w-40"> { formData.deliverToLine1 } </td>
                                </tr>
                            </thead>
                        </table>
                        <table className="table-fixed w-full pointer-events-none text-black text-xs">
                            <tbody>
                                <tr>
                                    <td className="px-4 pt-2 pb-4 border border-gray-400 border-t-0 h-8"> { formData.deliverToLine2 } </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <table className="w-full table-fixed col-start-1 col-end-7 mt-2.5">
                    <thead className="hide">
                        <tr>
                            <th></th>
                            <th></th>
                        </tr>
                        <tr>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* <tr colSpan={6} className="align-top">
                            <td className="pr-4 relative">
                                <p className="text-red-500">#{podNumber}</p>
                            </td>
                        </tr> */}
                        <tr>
                            <td colSpan={6}>
                                <table className="table-fixed min-w-full text-left border border-amber-100 mt-[-5px]">
                                    <thead className="bg-blue-100 text-black">
                                        <tr>
                                            <th className="px-4 pt-2 pb-4 border border-gray-400 w-[20%]">Quantity</th>
                                            <th className="px-4 pt-2 pb-4 border border-gray-400">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.map((i, idx) => (
                                            <tr className="text-black h-8" key={idx}>
                                                <td className="border border-gray-400 px-4 pt-2 pb-4 text-center">{i.quantity}</td>
                                                <td className="border border-gray-400 px-4 pt-2 pb-4 whitespace-pre-wrap">{i.description}</td>
                                            </tr>
                                        ))}

                                        {Array.from({
                                            length: Math.max(0, 8 - formData.items.length),
                                            }).map((_, idx) => (
                                            <tr className="text-black h-8" key={`empty-${idx}`}>
                                                <td className="border border-gray-400 px-4 py-2">&nbsp;</td>
                                                <td className="border border-gray-400 px-4 py-2">&nbsp;</td>
                                            </tr>
                                        ))} 
                                    </tbody>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td colSpan={6}>
                                <div className="flex justify-between mt-2">
                                    <div className="text-black">
                                        <h4 className="font-semibold mb-1">G-Chem Aquacare (Pty) Ltd</h4>
                                        <p>Tel: 0860 000 307</p>
                                        <p>Address: Unit 1. 37 Shiraz Road,</p>
                                        <p>Saxenburg Park 1. Blackheath, 7580</p>
                                        <p>VAT: 4230283006</p>
                                        <p>Co. Reg Nr: 2018/065082/07</p>
                                    </div>
                                    <div className="flex flex-col">
                                        <h6 className="text-black text-xs font-semibold">Document distribution: White (Customer copy) / Green (Supplier copy) / Yellow (Fast copy)</h6>
                                        <div className="flex mt-24 ml-[-40px]">
                                            <div className="text-black mt-[-3.8%]">
                                                <p className="pb-2 text-center"> {formData.receivedBy}</p>
                                                <hr className="w-64 border-1 border-black" />
                                                <h3 className="font-semibold">RECEIVED BY (PRINT NAME)</h3>
                                            </div>
                                            <div className="ml-2 mt-[-11.2%]">
                                                <img
                                                    src={formData.signature}
                                                    alt="Signature"
                                                    className="mx-auto w-[100px] h-[60px] object-contain mt-2"
                                                />
                                                <hr className="w-32 border-1 border-black" />
                                                <h3 className="text-black text-center font-semibold">SIGNATURE</h3>
                                            </div>
                                            <div className="ml-2 text-black text-center font-bold mt-[-3.8%]">
                                                <p className="pb-2"> { formattedDate } </p>
                                                <hr className="w-32 border-1 border-black" />
                                                <h3 className="font-semibold">DATE</h3>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div> );
}

export default ProofOfDelivery;