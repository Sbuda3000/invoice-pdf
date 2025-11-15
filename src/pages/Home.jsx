import Modal from 'react-modal';
import { useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { useNavigate } from 'react-router-dom';

Modal.setAppElement('#root');

const customStyles = {
    content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)'
    }
}

function Home () {
    const navigate = useNavigate();

    const subtitleRef = useRef(null);
    const signatureRef = useRef(null);

    const [modalIsOpen, setIsOpen] = useState(false);
    const [signature, setSignature] = useState(null);
    const [formData, setFormData] = useState(null);
    
    const [items, setItems] = useState([
        { item: '', quantity: '', rate: '' }
    ]);

    const calculateTotal = () => {
        return items.reduce((sum, i) => sum + (i.quantity * i.rate), 0).toFixed(2);
    };

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

    const handleFormSubmit = (e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const formDataObj = {
            name: formData.get('name'),
            address: formData.get('address'),
            addressLine1: formData.get('address-line1'),
            addressLine2: formData.get('address-line2'),
            invoiceDate: formData.get('invoice-date'),
            dueDate: formData.get('due-date'),
            items,
            total: calculateTotal()
        };
        setFormData(formDataObj);
        captureSignature(formDataObj);

        openModal();
    }

    const captureSignature = (data) => {
        if (signatureRef.current) {
            setSignature(signatureRef.current.getTrimmedCanvas().toDataURL('image/png'));

            if (data) {
                navigate('/invoice', { 
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

    const addItem = () => {
        setItems([...items, { item: '', quantity: 1, rate: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) {
            alert("You must have at least one item in your invoice.");
            return;
        }

        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
    };

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
                        <label className="block text-sm font-medium text-gray-700">
                            Deliver To:
                        </label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Enter person delivering to"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Order No.
                            </label>
                            <input
                                type="text"
                                name="address"
                                placeholder="Enter Order No."
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Date
                            </label>
                            <input
                                type="date"
                                name="date"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                        </div>
                    </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                On Behalf Of
                            </label>
                            <input
                                type="text"
                                name="on-behalf"
                                placeholder="Enter name"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
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

                    <div>
                        <h3 className="font-semibold text-lg text-gray-800 mb-2">Items</h3>
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center mb-2">
                                <input
                                    type="number"
                                    name='quantity'
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                    className="border p-2 rounded-md"
                                />
                                <input
                                    type="text"
                                    name='item'
                                    placeholder="Item name"
                                    value={item.item}
                                    onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                    className="border p-2 rounded-md col-span-3"
                                />
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md"
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
            style={customStyles}
            contentLabel="Signature Pad"
        >
            <div className=" w-full gap-2 md:flex-row mb-3 text-black">
                <p className='mb-3'>Signature Pad</p>
                <SignaturePad
                    ref={signatureRef}
                    canvasProps={{ width: 500, className: "signatureCanvas border border-gray-300 rounded-md" }}
                />
                <div className='flex justify-between mt-3'>
                    <button onClick={clearSignature}> Clear </button>
                    <button
                        form='form-modal-submit'
                        onClick={() => {
                            captureSignature(formData);
                        }}
                        className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition'>
                            Generate Invoice
                    </button>

                </div>
            </div>
        </Modal>
        </> 
    );
}

export default Home;