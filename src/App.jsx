import {
  createBrowserRouter,
  RouterProvider
} from "react-router";

import Home from './pages/Home';
import Invoice from "./pages/Invoice";

import './App.css';

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Home />
    },
    {
      path: "/invoice",
      element: <Invoice />
    }
  ])
  return (<RouterProvider router={router} />);

}

export default App;