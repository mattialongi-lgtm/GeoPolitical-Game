import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/state/IT');
    console.log("Status:", res.status);
    console.log("Regions Count:", res.data.regions?.length);
    console.log("Regions Sample:", res.data.regions?.slice(0, 3));
  } catch (err: any) {
    console.error("Error:", err.response?.data || err.message);
  }
}

test();
