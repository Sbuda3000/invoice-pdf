import {
  createBrowserRouter,
  RouterProvider
} from "react-router";

import Home from './pages/Home';
import ProofOfDelivery from "./pages/ProofOfDelivery";

import './App.css';

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Home />
    },
    {
      path: "/proof-of-delivery",
      element: <ProofOfDelivery />
    }
  ])
  return (<RouterProvider router={router} />);

}

export default App;