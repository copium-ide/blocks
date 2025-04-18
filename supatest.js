// database url:
const url = "https://bmkocgtuwuwdoakptqan.supabase.co";
// public api
const api = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta29jZ3R1d3V3ZG9ha3B0cWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NDk1NzAsImV4cCI6MjA2MDIyNTU3MH0.Hi5KxIT8T9jED2JbHO25TcdUcBFDfCPHgPxOttjezEo";
// supabase instance
const supabase = createClient(url, api);

async function insertData() {
    const { data, error } = await supabase
        .from('test')  // Replace with your table name
        .insert([{ id: 1, name: 'Example Data' }]) // Data to insert
        .select(); // Optional: to return the inserted record

    if (error) {
        console.error('Error inserting data:', error)
        const newDiv = document.createElement('div');

// 2. Set the background color to green
newDiv.style.backgroundColor = 'red';

// 3. Optionally, set other styles (e.g., width, height, etc.)
newDiv.style.width = '100px';
newDiv.style.height = '100px';

// 4. Add the div to the document (e.g., to the body)
document.body.appendChild(newDiv);
    } else {
        console.log('Data inserted successfully:', data)
        const newDiv = document.createElement('div');

// 2. Set the background color to green
newDiv.style.backgroundColor = 'green';

// 3. Optionally, set other styles (e.g., width, height, etc.)
newDiv.style.width = '100px';
newDiv.style.height = '100px';

// 4. Add the div to the document (e.g., to the body)
document.body.appendChild(newDiv);
    }
}

insertData()
