import Modal from 'react-modal';
import { useEffect, useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../lib/supabase";

Modal.setAppElement('#root');

const desktopModalStyles = {
    content: {
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        marginRight: "-50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        maxHeight: "80vh",
        padding: "20px",
    },
};

// We'll override when on mobile
const mobileModalStyles = {
    content: {
        top: "5%",
        left: "50%",
        right: "50%",
        bottom: "5%",
        transform: "translateX(-50%)",
        width: "95vw",
        height: "90vh",
        padding: "12px 10px",
        borderRadius: "8px",
    },
};

function Home () {
    const navigate = useNavigate();

    const subtitleRef = useRef(null);
    const signatureRef = useRef(null);

    const [modalIsOpen, setIsOpen] = useState(false);
    const [signature, setSignature] = useState(null);
    const [formData, setFormData] = useState(null);
    const [today, setToday] = useState("");
    
    const [items, setItems] = useState([
        { id: Date.now(), item: '', quantity: '', rate: '' }
    ]);

    const [canvasProps, setCanvasProps] = useState({
        width: 800,
        height: 400,
        style: { width: "400px", height: "200px" },
    });
    const [isMobile, setIsMobile] = useState(false);

    function openModal() {
        setIsOpen(true);
    }

    function afterOpenModal() {
        if (subtitleRef.current) {
            subtitleRef.current.style.color = "#f00";
        }
    }

    function closeModal() {
        setIsOpen(false);
    }

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const podNumber = await getCurrentPodNumber(); 

        const formDataObj = {
            podNumber,
            deliverToLine1: formData.get('deliverToLine1'),
            deliverToLine2: formData.get('deliverToLine2'),
            orderNo: formData.get('orderNo'),
            date: formData.get('date'),
            onBehalf: formData.get('onBehalf'),
            instructor: formData.get('instructor'),
            receivedBy: formData.get('receivedBy'),
            items
        };
        setFormData(formDataObj);
        captureSignature(formDataObj);

        openModal();
    }

    const captureSignature = (data) => {
        if (signatureRef.current) {
            setSignature(signatureRef.current.getTrimmedCanvas().toDataURL('image/png'));

            if (data) {
                navigate('/proof-of-delivery', { 
                    state: { 
                        ...data, 
                        signature: signatureRef.current.getTrimmedCanvas().toDataURL('image/png') } 
                    });
            }
        }
        closeModal();
    }

    const clearSignature = () => {
        if (signatureRef.current) {
            signatureRef?.current?.clear();
            setSignature(null);
        }
    }

    // Item List Controllers
    const handleItemChange = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;
        setItems(updatedItems);
    };

    const handleDescriptionKeyDown = (e, index) => {
        if (e.key === "Tab") {
            e.preventDefault(); // stop focus from jumping to the next field

            const TAB_SPACES = "    "; // 4 spaces – change to "\t" if you REALLY want a tab char

            const target = e.target;
            const { selectionStart, selectionEnd, value } = target;

            const newValue =
            value.substring(0, selectionStart) +
            TAB_SPACES +
            value.substring(selectionEnd);

            // Update the item description in state
            handleItemChange(index, "description", newValue);

            // Put the cursor after the inserted spaces
            requestAnimationFrame(() => {
            target.selectionStart = target.selectionEnd =
                selectionStart + TAB_SPACES.length;
            });
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now() + Math.random(), quantity: '', description: '' }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) {
            alert("You must have at least one item in your POD.");
            return;
        }

        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
    };

    // Compute canvas size based on viewport and DPR
    const computeCanvasSize = () => {
        const DPR = window.devicePixelRatio || 1;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // If mobile: make tall vertical pad (portrait)
        if (vw <= 640) {
            // cssWidth is relatively narrow, cssHeight is tall
            const cssWidth = Math.min(vw * 0.9, 420);   // e.g. 90% of viewport but max 420px
            const cssHeight = Math.min(vh * 0.6, 560);  // tall; 60% of viewport height or up to 900px
            return {
                width: Math.round(cssWidth * DPR),
                height: Math.round(cssHeight * DPR),
                style: { width: `${Math.round(cssWidth)}px`, height: `${Math.round(cssHeight)}px` },
            };
        }

        if (vw <= 768) {
            const cssWidth = Math.min(vw * 0.9, 721);   // e.g. 90% of viewport but max 721px
            return {
                width: cssWidth + 10
            };
        }

        if (vw <= 940) {
            const cssWidth = Math.min(vw * 0.9, 828);   // e.g. 90% of viewport but max 828px
            return {
                width: cssWidth + 30
            };
        }

        if (vw <= 1040) {
            const cssWidth = Math.min(vw * 0.9, 946);   // e.g. 90% of viewport but max 946px
            return {
                width: cssWidth + 20
            };
        }

        // Desktop: wider but shorter
        const cssWidth = Math.min(vw * 0.75, 558);
        const cssHeight = Math.min(vh * 0.6, 250);

        return {
            width: Math.round(cssWidth * DPR),
            height: Math.round(cssHeight * DPR),
            style: { width: `${Math.round(cssWidth)}px`, height: `${Math.round(cssHeight)}px` },
        };
    };

    async function getCurrentPodNumber() {
        const { data, error } = await supabase.rpc("get_current_pod_number");
        if (error) throw error;
        return data;
    }

    useEffect(() => {
        // compute today in YYYY-MM-DD
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        setToday(`${yyyy}-${mm}-${dd}`);

        // initial determine
        const mobile = window.innerWidth <= 640 || window.innerHeight > window.innerWidth;
        setIsMobile(mobile);
        setCanvasProps(computeCanvasSize());

        // handle resize/orientation change
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 640 || window.innerHeight > window.innerWidth);
            setCanvasProps(computeCanvasSize());
            // clear canvas when resizing to avoid mismatch
            if (signatureRef.current) {
                signatureRef.current.clear();
            }
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
        };
    }, []);

    return ( 
        <>
            <div className="min-h-screen bg-gray-100 py-10 px-4">
                <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8">
                    <h2 className="text-2xl text-center font-bold mb-6 text-gray-800">
                        Delivery Form
                    </h2>

                    <form
                        onSubmit={handleFormSubmit}
                        id="form-modal-submit"
                        className="space-y-5"
                    >
                        <div>
                            <label htmlFor="deliverTo" className="block text-sm font-medium text-gray-700">
                                Deliver To:
                            </label>
                            <input
                                type="text"
                                name="deliverToLine1"
                                placeholder="Enter name"
                                maxLength={52}
                                className="mt-1 block w-[60%] border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input
                                type="text"
                                name="deliverToLine2"
                                placeholder="Enter name"
                                maxLength={83}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="orderNo" className="block text-sm font-medium text-gray-700">
                                    Order No.
                                </label>
                                <input
                                    type="text"
                                    name="orderNo"
                                    placeholder="Enter Order No."
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    defaultValue={today}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="onBehalf" className="block text-sm font-medium text-gray-700">
                                    On Behalf Of
                                </label>
                                <input
                                    id="onBehalf"
                                    type="text"
                                    name="onBehalf"
                                    placeholder="Enter name"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                            </div>
                            <div>
                                <label htmlFor="instructor" className="block text-sm font-medium text-gray-700">
                                    Instructed By
                                </label>
                                <input
                                    type="text"
                                    name="instructor"
                                    placeholder="Enter name"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="receivedBy" className="block text-sm font-medium text-gray-700">
                                    Received By (Print Name)
                                </label>
                                <input
                                    id="receivedBy"
                                    type="text"
                                    name="receivedBy"
                                    placeholder="Name of person receiving"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg text-gray-800 mb-2">Items</h3>
                            {items.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center mb-2">
                                    <input
                                        type="number"
                                        name='quantity'
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                        className="border p-2 rounded-md"
                                    />
                                    <input
                                        type="text"
                                        name='description'
                                        placeholder="Item name"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                        onKeyDown={(e) => handleDescriptionKeyDown(e, index)}
                                        className="border p-2 rounded-md col-span-3"
                                    />
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        disabled={items.length >= 8}
                                        className={`px-3 py-1 rounded-md text-white ${
                                            items.length >= 8
                                                ? "bg-gray-400 cursor-not-allowed"
                                                : "bg-green-500 hover:bg-green-600"
                                        }`}
                                    >
                                        + Add Item
                                    </button>
                                    {items.length > 1 && index !== 0 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition"
                            >
                                Go For Sign
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <Modal
                isOpen={modalIsOpen}
                onAfterOpen={afterOpenModal}
                onRequestClose={closeModal}
                style={isMobile ? mobileModalStyles : desktopModalStyles}
                contentLabel="Signature Pad"
            >
                <div className=" w-full gap-2 md:flex-row mb-3 text-black">
                    <p className='mb-3'>Signature Pad</p>
                    <SignaturePad
                        ref={signatureRef}
                        canvasProps={{ 
                            width: canvasProps.width,
                            className: "signatureCanvas border border-gray-300 rounded-md" }}
                    />
                    <div className='flex justify-between mt-3'>
                        <button onClick={clearSignature}> Clear </button>
                        <button
                            form='form-modal-submit'
                            onClick={() => {
                                captureSignature(formData);
                            }}
                            className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition'>
                                Generate POD
                        </button>

                    </div>
                </div>
            </Modal>
        </> 
    );
}

export default Home;