const submitBtn = document.getElementById("submit") 
const logoutBtn = document.getElementById("logout-btn") 
const inputFile = document.getElementById("zipfile")
const getBtn = document.getElementById("getInfo")
const output = document.getElementById("output")
var switchBtn = document.getElementById("switch-btn");
var login_screen = document.getElementById("login-screen");
var register_screen = document.getElementById("register-screen");
let uploaded_file = null;

const isDevelopment = window.location.hostname === "localhost"

const baseUrl = isDevelopment ? "http://localhost" : "https://instagram-tool.duckdns.org";

getBtn.addEventListener('click', recieveInfo)
submitBtn.addEventListener('click', sendInfo)
logoutBtn.addEventListener('click', logOut)
function uploadFiles() {
    // Initial file sanitation
    if (inputFile.files[0].size > 10*1024*1024) {
        document.getElementById("message").className = "err-message"
        document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">Your file is too big!</p>'
        return
    }
    else if (inputFile.files[0] == null) {
        return
    }
    displayProgress(0,1);
    document.getElementById("message").innerHTML = ''
    document.getElementById("progress-bar1").style.outline = 'none'
    document.getElementById("progress-bar2").style.outline = 'none'
    calcProgress(inputFile.files[0], 1)
}
function displayProgress(percentComplete, file_num){
    // Displays progress on screen
    const fileBox = document.getElementById('progress-bar' + file_num)
    const progressStatus = document.getElementById('file'+ file_num + '-percent');
    const progressBar = document.getElementById('file'+file_num+"-bar")
    fileBox.style.visibility = "visible"
    progressBar.value = percentComplete
    progressStatus.textContent = Math.round(percentComplete) + '%';
}
function calcProgress(file, file_num) {
    // Calculates progress based on file size and average MB upload speed to give a good estimate
    const statusBar = document.getElementById('file' + file_num + '-status');
    statusBar.textContent = "Uploading..."
    const totalSize = file.size;
    let uploadedSize = 0;
    const interval = setInterval(() => {
        if (uploadedSize < totalSize) {
            uploadedSize += 5*1024*1024;
            if (uploadedSize > totalSize) {
                uploadedSize = totalSize; // Prevent exceeding total size
            }
            const percentComplete = (uploadedSize / totalSize) * 100; // Calculate progress
            displayProgress(percentComplete, file_num); // Update the progress bar
        } else {
            clearInterval(interval); // Stop the interval when upload is complete
            const statusBar = document.getElementById('file' + file_num + '-status');
            const progressStatus = document.getElementById('file'+ file_num + '-percent');
            progressStatus.innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;"><img src="../images/checkmark-svgrepo-com.svg"/></p>'
            statusBar.textContent = file.name + " • Uploaded"
            uploaded_file = file;
        }
    }, 200)
}
async function logOut(e) {
    document.getElementById("logout-btn").innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div>`
    const res = await fetch(baseUrl + '/logout', {
        method: 'POST',
        credentials: 'include'
    
    })
    if (res.ok) {
        transition();
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 200); // 1000 ms = 1 second
    }
}
function transition(){
    const bodyElements = document.querySelectorAll('.transition');
    bodyElements.forEach(element => {
        element.classList.add('fade');
    })
}
// Switches to output screen
function toOutput(){
    login_screen.style.left = "-400px";
    register_screen.style.left = "50px";
    switchBtn.style.left = "110px";
};
// Switches to upload screen
function toUpload(){
    login_screen.style.left = "50px";
    register_screen.style.left = "450px";
    switchBtn.style.left = "0px";
};
window.onload = async function() {
    const res = await fetch(baseUrl + '/protected', { 
        method: 'GET',
        credentials: 'include' 
    })
    if (res.status === 401) {
        // User isnt authenticated, so redirect to login
        window.location.href = '../index.html'; 
    } else if (res.status === 403) {
        // Token is invalid, so redirect to login
        window.location.href = '../index.html'; 
    }
};
async function recieveInfo(e) { 
    e.preventDefault()
    document.getElementById("getInfo").innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div>`
    const res = await fetch(baseUrl + '/data', {
        method: 'GET',
        credentials: 'include'
    })
    document.getElementById("getInfo").innerHTML = "Get"
    if (res.ok) {
        // Waits for data to transfer
        const data = await res.json()
        const tableBody = document.querySelector('#userTable tbody');
        // Loops through data and sets html elements respectively
        data[0].forEach(user => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            const img = document.createElement('td');
            img.innerHTML = `<a class="profile-link" target="_blank" rel="noopener noreferrer" href="${user.following_link}"><img src="../images/user.svg" width="36" height="36" alt="User Icon"></a>`;
            cell.textContent = user.following_id

            // Append the image to the cell
            row.appendChild(img);
            row.appendChild(cell);
            tableBody.appendChild(row);
        });
        document.getElementById("message").className = "message"
        document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">Succesfully parsed<img src="../images/checkmark-svgrepo-com.svg"/></p>'
    }
    else if (res.status === 400) {
        // Displays error message
        document.getElementById("message").className = "err-message"
        document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">Try Uploading A File!</p>'
    }
}
async function sendInfo(e) {
    e.preventDefault()
    if (uploaded_file == null) { 
        document.getElementById("message").className = "err-message"
        document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">No Files Found</p>'
        return 
    }
    document.getElementById("submit").innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div>`
    // Creates form and sends a post request to server API.
    const formData = new FormData()
    formData.append("zipfile", uploaded_file)
    const res = await fetch(baseUrl + '/uploads', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    
    })
    if (res.ok) {
        // Waits for data to transfer
        const data = await res.json()
        const tableBody = document.querySelector('#userTable tbody');
        // Loops through data and sets html elements respectively
        data[0].forEach(user => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            const img = document.createElement('td');
            img.innerHTML = `<a class="profile-link" target="_blank" rel="noopener noreferrer" href="${user.following_link}"><img src="../images/user.svg" width="36" height="36" alt="User Icon"></a>`;
            cell.textContent = user.following_id
            row.appendChild(img);
            row.appendChild(cell);
            tableBody.appendChild(row);
        });
        document.getElementById("submit").innerHTML = "Submit"
        document.getElementById("message").className = "message"
        document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">Succesfully uploaded and parsed<img src="../images/checkmark-svgrepo-com.svg"/></p>'
    }
    else {
        if (res.status === 401) {
            // Redirects to main page due to not authorized
            logOut()

        }
        else if (res.status === 403) {
            // Redirects to main page due to not authorized
            logOut()
            
        }
        else if (res.status === 500) {
            // Display file parsing error
            document.getElementById("submit").innerHTML = "Submit"
            document.getElementById("message").className = "err-message"
            document.getElementById("progress-bar1").style.outline = 'rgb(255, 0, 0) solid 1px'
            document.getElementById("progress-bar2").style.outline = 'rgb(255, 0, 0) solid 1px'
            document.getElementById("message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; align-items: center;">Incorrect file, please try again.</p>'
        }
    }
}