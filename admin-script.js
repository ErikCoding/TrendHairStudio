// Admin credentials (in production, this should be handled server-side)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
}

// Opening Hours Configuration
const openingHours = {
  0: null, // Sunday - closed
  1: null, // Monday - closed
  2: { start: 9, end: 18 }, // Tuesday
  3: { start: 9, end: 18 }, // Wednesday
  4: { start: 9, end: 18 }, // Thursday
  5: { start: 9, end: 18 }, // Friday
  6: { start: 8, end: 15 }, // Saturday
}

let isLoggedIn = false

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
import {
  getDatabase,
  ref,
  push,
  get,
  remove,
  update,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"

// Firebase configuration - User needs to replace with their own config
const firebaseConfig = {
  apiKey: "AIzaSyAsrN8hUNHkXmtXW2C4h-cloI8o_8rhyQM",
  authDomain: "trend-hair-studio.firebaseapp.com",
  databaseURL: "https://trend-hair-studio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "trend-hair-studio",
  storageBucket: "trend-hair-studio.firebasestorage.app",
  messagingSenderId: "1076468832173",
  appId: "1:1076468832173:web:4ea3dbfb893d3a95a5f324",
}

// Initialize Firebase
let app, database, bookingsRef, blockedDatesRef, blockInfoRef, contactMessagesRef
try {
  app = initializeApp(firebaseConfig)
  database = getDatabase(app)
  bookingsRef = ref(database, "bookings")
  blockedDatesRef = ref(database, "blockedDates")
  blockInfoRef = ref(database, "blockInfo")
  contactMessagesRef = ref(database, "contactMessages") // Added contactMessagesRef for reading contact messages
  console.log("[v0] Firebase initialized successfully")
} catch (error) {
  console.error("[v0] Firebase initialization error:", error)
  console.log("[v0] Please configure Firebase in admin-script.js")
}

// DOM Elements
const loginScreen = document.getElementById("loginScreen")
const adminDashboard = document.getElementById("adminDashboard")
const loginForm = document.getElementById("loginForm")
const logoutBtn = document.getElementById("logoutBtn")

// Show appropriate screen on load
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Admin panel DOM loaded")

  // Check session storage
  isLoggedIn = sessionStorage.getItem("adminLoggedIn") === "true"
  console.log("[v0] isLoggedIn:", isLoggedIn)

  if (isLoggedIn) {
    showDashboard()
  } else {
    showLogin()
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin)
    console.log("[v0] Login form handler attached")
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout)
    console.log("[v0] Logout button handler attached")
  }
})

function handleLogin(e) {
  e.preventDefault()
  console.log("[v0] Login form submitted")

  const username = document.getElementById("username").value
  const password = document.getElementById("password").value

  console.log("[v0] Checking credentials...")

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    console.log("[v0] Credentials correct, logging in")
    sessionStorage.setItem("adminLoggedIn", "true")
    isLoggedIn = true
    showDashboard()
  } else {
    console.log("[v0] Credentials incorrect")
    alert("Nieprawidłowa nazwa użytkownika lub hasło!")
  }
}

function handleLogout() {
  console.log("[v0] Logging out")
  sessionStorage.removeItem("adminLoggedIn")
  isLoggedIn = false
  showLogin()
}

function showLogin() {
  console.log("[v0] showLogin called")

  const loginScreen = document.getElementById("loginScreen")
  const adminDashboard = document.getElementById("adminDashboard")

  if (!loginScreen || !adminDashboard) {
    console.error("[v0] Login screen or admin dashboard element not found!")
    return
  }

  loginScreen.style.display = "flex"
  adminDashboard.style.display = "none"

  console.log("[v0] Login screen displayed")
}

function showDashboard() {
  console.log("[v0] showDashboard called")

  const loginScreen = document.getElementById("loginScreen")
  const adminDashboard = document.getElementById("adminDashboard")

  if (!loginScreen || !adminDashboard) {
    console.error("[v0] Login screen or admin dashboard element not found!")
    return
  }

  loginScreen.style.display = "none"
  adminDashboard.style.display = "block"

  console.log("[v0] Dashboard displayed")

  // Load data
  if (database) {
    try {
      loadBookings()
      loadBlockedDates()
      updateStatistics()
      setupBookingListener()
    } catch (error) {
      console.error("[v0] Error loading dashboard data:", error)
    }
  } else {
    console.log("[v0] Firebase not configured, showing empty dashboard")
  }
}

const lastBookingCount = 0
let isFirstLoad = true
let notifiedBookingIds = new Set()

function setupBookingListener() {
  if (!database) return

  onValue(bookingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const bookingsData = snapshot.val()
      const bookingIds = Object.keys(bookingsData)

      if (!isFirstLoad) {
        const newBookings = bookingIds.filter((id) => !notifiedBookingIds.has(id))

        if (newBookings.length > 0) {
          showNotification(newBookings.length)
          loadBookings()
          updateStatistics()
        }
      }

      notifiedBookingIds = new Set(bookingIds)
      isFirstLoad = false
    }
  })
}

function showNotification(count) {
  const badge = document.getElementById("notificationBadge")
  const bell = document.getElementById("notificationBell")

  if (badge && bell) {
    badge.textContent = count
    badge.style.display = "flex"

    bell.style.animation = "bellRing 0.5s ease"
    setTimeout(() => {
      bell.style.animation = ""
    }, 500)
  }
}

document.getElementById("notificationBell")?.addEventListener("click", () => {
  const badge = document.getElementById("notificationBadge")
  if (badge) {
    badge.style.display = "none"
  }
  loadBookings()
})

async function loadBookings(filterDate = "", filterService = "", filterStylist = "") {
  if (!database) {
    document.getElementById("bookingsList").innerHTML =
      '<div class="empty-state">Firebase nie jest skonfigurowany</div>'
    return
  }

  const snapshot = await get(bookingsRef)
  const bookingsList = document.getElementById("bookingsList")

  if (!snapshot.exists()) {
    bookingsList.innerHTML = '<div class="empty-state">Brak rezerwacji do wyświetlenia</div>'
    return
  }

  const bookingsData = snapshot.val()
  let bookings = Object.keys(bookingsData).map((key) => ({
    id: key,
    ...bookingsData[key],
  }))

  // Filter bookings
  if (filterDate) {
    bookings = bookings.filter((b) => b.date === filterDate)
  }

  if (filterService) {
    bookings = bookings.filter((b) => b.service === filterService)
  }

  if (filterStylist) {
    bookings = bookings.filter((b) => b.stylist === filterStylist)
  }

  // Sort by date and time
  bookings.sort((a, b) => {
    const dateA = new Date(a.date + " " + a.time)
    const dateB = new Date(b.date + " " + b.time)
    return dateA - dateB
  })

  if (bookings.length === 0) {
    bookingsList.innerHTML = '<div class="empty-state">Brak rezerwacji do wyświetlenia</div>'
    return
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  bookingsList.innerHTML = bookings
    .map((booking) => {
      const isNew = booking.createdAt > fiveMinutesAgo
      return `
        <div class="booking-card ${isNew ? "new-booking" : ""}">
            <div class="booking-info">
                <div class="booking-field">
                    <label>Klient</label>
                    <span>${booking.name}</span>
                </div>
                <div class="booking-field">
                    <label>Telefon</label>
                    <span>${booking.phone}</span>
                </div>
                <div class="booking-field">
                    <label>Email</label>
                    <span>${booking.email || "-"}</span>
                </div>
                <div class="booking-field">
                    <label>Fryzjer</label>
                    <span>${booking.stylist || "-"}</span>
                </div>
                <div class="booking-field">
                    <label>Usługa</label>
                    <span>${booking.service}</span>
                </div>
                <div class="booking-field">
                    <label>Data</label>
                    <span>${booking.date}</span>
                </div>
                <div class="booking-field">
                    <label>Godzina</label>
                    <span>${booking.time}</span>
                </div>
                ${
                  booking.notes
                    ? `
                <div class="booking-field" style="grid-column: 1 / -1;">
                    <label>Uwagi</label>
                    <span>${booking.notes}</span>
                </div>
                `
                    : ""
                }
            </div>
            <div class="booking-actions">
                <button class="btn btn-success" onclick="editBooking('${booking.id}')">Przenieś</button>
                <button class="btn btn-danger" onclick="deleteBooking('${booking.id}')">Anuluj</button>
            </div>
        </div>
    `
    })
    .join("")
}

// Tab Navigation
const tabButtons = document.querySelectorAll(".tab-btn")
const tabContents = document.querySelectorAll(".tab-content")

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab

    tabButtons.forEach((btn) => btn.classList.remove("active"))
    tabContents.forEach((content) => content.classList.remove("active"))

    button.classList.add("active")
    document.getElementById(`${tabName}Tab`).classList.add("active")

    if (tabName === "bookings") {
      loadBookings()
    } else if (tabName === "blocked") {
      loadBlockedDates()
    } else if (tabName === "messages") {
      // Added messages tab handler
      loadMessages()
    } else if (tabName === "stats") {
      updateStatistics()
    }
  })
})

async function deleteBooking(id) {
  showConfirmModal("Czy na pewno chcesz anulować tę rezerwację?", async () => {
    try {
      await remove(ref(database, `bookings/${id}`))
      loadBookings()
      updateStatistics()
    } catch (error) {
      console.error("[v0] Error deleting booking:", error)
      alert("Wystąpił błąd podczas usuwania rezerwacji")
    }
  })
}

let editingBookingId = null

function editBooking(id) {
  editingBookingId = id

  get(ref(database, `bookings/${id}`)).then((snapshot) => {
    if (!snapshot.exists()) return

    const booking = snapshot.val()

    document.getElementById("editBookingId").value = id
    document.getElementById("editBookingStylist").value = booking.stylist
    document.getElementById("editDate").value = booking.date

    updateEditTimeSlots(booking.date, booking.time, booking.stylist)

    document.getElementById("editModal").style.display = "block"
  })
}

async function updateEditTimeSlots(dateString, currentTime, stylist) {
  const date = new Date(dateString + "T00:00:00")
  const dayOfWeek = date.getDay()
  const hours = openingHours[dayOfWeek]
  const editTimeSelect = document.getElementById("editTime")

  editTimeSelect.innerHTML = '<option value="">Wybierz godzinę</option>'

  if (!hours) {
    editTimeSelect.innerHTML = '<option value="">Salon nieczynny w tym dniu</option>'
    return
  }

  const slots = []
  for (let hour = hours.start; hour < hours.end; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`)
    if (hour + 0.5 < hours.end) {
      slots.push(`${hour.toString().padStart(2, "0")}:30`)
    }
  }

  const snapshot = await get(bookingsRef)
  const bookings = snapshot.exists() ? Object.values(snapshot.val()) : []

  slots.forEach((slot) => {
    const isBooked = bookings.some(
      (b) => b.date === dateString && b.time === slot && b.stylist === stylist && b.id !== editingBookingId,
    )

    if (!isBooked || slot === currentTime) {
      const option = document.createElement("option")
      option.value = slot
      option.textContent = slot
      if (slot === currentTime) {
        option.selected = true
      }
      editTimeSelect.appendChild(option)
    }
  })
}

document.getElementById("editDate")?.addEventListener("change", (e) => {
  const stylist = document.getElementById("editBookingStylist").value
  updateEditTimeSlots(e.target.value, "", stylist)
})

document.getElementById("editBookingForm")?.addEventListener("submit", async (e) => {
  e.preventDefault()

  const id = document.getElementById("editBookingId").value
  const newDate = document.getElementById("editDate").value
  const newTime = document.getElementById("editTime").value

  try {
    await update(ref(database, `bookings/${id}`), {
      date: newDate,
      time: newTime,
    })

    document.getElementById("editModal").style.display = "none"
    loadBookings()
    updateStatistics()
  } catch (error) {
    console.error("[v0] Error updating booking:", error)
    alert("Wystąpił błąd podczas aktualizacji rezerwacji")
  }
})

document.getElementById("closeEditModal")?.addEventListener("click", () => {
  document.getElementById("editModal").style.display = "none"
})

document.getElementById("cancelEditBtn")?.addEventListener("click", () => {
  document.getElementById("editModal").style.display = "none"
})

document.getElementById("addBlockBtn")?.addEventListener("click", () => {
  document.getElementById("blockForm").style.display = "block"
})

document.getElementById("cancelBlockBtn")?.addEventListener("click", () => {
  document.getElementById("blockForm").style.display = "none"
  document.getElementById("blockDateForm").reset()
})

document.getElementById("blockDateForm")?.addEventListener("submit", async (e) => {
  e.preventDefault()

  const startDate = document.getElementById("blockStartDate").value
  const endDate = document.getElementById("blockEndDate").value
  const reason = document.getElementById("blockReason").value

  if (new Date(startDate) > new Date(endDate)) {
    alert("Data końcowa nie może być wcześniejsza niż data początkowa!")
    return
  }

  const dates = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0])
    current.setDate(current.getDate() + 1)
  }

  try {
    for (const date of dates) {
      await push(blockedDatesRef, date)
    }

    await push(blockInfoRef, {
      startDate,
      endDate,
      reason: reason || "Brak powodu",
      dates,
    })

    document.getElementById("blockForm").style.display = "none"
    document.getElementById("blockDateForm").reset()
    loadBlockedDates()
  } catch (error) {
    console.error("[v0] Error blocking dates:", error)
    alert("Wystąpił błąd podczas blokowania dat")
  }
})

async function loadBlockedDates() {
  if (!database) {
    document.getElementById("blockedDatesList").innerHTML =
      '<div class="empty-state">Firebase nie jest skonfigurowany</div>'
    return
  }

  const snapshot = await get(blockInfoRef)
  const blockedDatesList = document.getElementById("blockedDatesList")

  if (!snapshot.exists()) {
    blockedDatesList.innerHTML = '<div class="empty-state">Brak zablokowanych dat</div>'
    return
  }

  const blockInfoData = snapshot.val()
  const blocks = Object.keys(blockInfoData).map((key) => ({
    id: key,
    ...blockInfoData[key],
  }))

  blockedDatesList.innerHTML = blocks
    .map(
      (block) => `
        <div class="blocked-date-card">
            <div class="blocked-date-info">
                <h4>${block.startDate} - ${block.endDate}</h4>
                <p>${block.reason}</p>
            </div>
            <button class="btn btn-danger" onclick="unblockDates('${block.id}')">Odblokuj</button>
        </div>
    `,
    )
    .join("")
}

async function unblockDates(blockId) {
  showConfirmModal("Czy na pewno chcesz odblokować te daty?", async () => {
    try {
      const snapshot = await get(ref(database, `blockInfo/${blockId}`))
      if (snapshot.exists()) {
        const block = snapshot.val()

        const blockedSnapshot = await get(blockedDatesRef)
        if (blockedSnapshot.exists()) {
          const blockedData = blockedSnapshot.val()
          for (const [key, date] of Object.entries(blockedData)) {
            if (block.dates.includes(date)) {
              await remove(ref(database, `blockedDates/${key}`))
            }
          }
        }

        await remove(ref(database, `blockInfo/${blockId}`))
        loadBlockedDates()
      }
    } catch (error) {
      console.error("[v0] Error unblocking dates:", error)
      alert("Wystąpił błąd podczas odblokowywania dat")
    }
  })
}

async function updateStatistics() {
  if (!database) {
    document.getElementById("totalBookings").textContent = "0"
    document.getElementById("todayBookings").textContent = "0"
    document.getElementById("upcomingBookings").textContent = "0"
    document.getElementById("popularService").textContent = "-"
    document.getElementById("servicesChart").innerHTML =
      '<div class="empty-state">Firebase nie jest skonfigurowany</div>'
    return
  }

  const snapshot = await get(bookingsRef)
  const today = new Date().toISOString().split("T")[0]

  if (!snapshot.exists()) {
    document.getElementById("totalBookings").textContent = "0"
    document.getElementById("todayBookings").textContent = "0"
    document.getElementById("upcomingBookings").textContent = "0"
    document.getElementById("popularService").textContent = "-"
    document.getElementById("servicesChart").innerHTML = '<div class="empty-state">Brak danych</div>'
    return
  }

  const bookingsData = snapshot.val()
  const bookings = Object.values(bookingsData)

  document.getElementById("totalBookings").textContent = bookings.length

  const todayBookings = bookings.filter((b) => b.date === today).length
  document.getElementById("todayBookings").textContent = todayBookings

  const upcomingBookings = bookings.filter((b) => b.date >= today).length
  document.getElementById("upcomingBookings").textContent = upcomingBookings

  const serviceCounts = {}
  bookings.forEach((b) => {
    serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1
  })

  const popularService = Object.keys(serviceCounts).reduce((a, b) => (serviceCounts[a] > serviceCounts[b] ? a : b), "-")
  document.getElementById("popularService").textContent = popularService

  const servicesChart = document.getElementById("servicesChart")
  const maxCount = Math.max(...Object.values(serviceCounts), 1)

  servicesChart.innerHTML = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([service, count]) => {
      const percentage = (count / maxCount) * 100
      return `
                <div class="service-bar">
                    <span class="service-name">${service}</span>
                    <div class="service-progress">
                        <div class="service-progress-fill" style="width: ${percentage}%">
                            ${count}
                        </div>
                    </div>
                </div>
            `
    })
    .join("")
}

function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById("confirmModal")
  document.getElementById("confirmMessage").textContent = message
  modal.style.display = "block"

  const yesBtn = document.getElementById("confirmYes")
  const noBtn = document.getElementById("confirmNo")

  const handleYes = () => {
    onConfirm()
    modal.style.display = "none"
    cleanup()
  }

  const handleNo = () => {
    modal.style.display = "none"
    cleanup()
  }

  const cleanup = () => {
    yesBtn.removeEventListener("click", handleYes)
    noBtn.removeEventListener("click", handleNo)
  }

  yesBtn.addEventListener("click", handleYes)
  noBtn.addEventListener("click", handleNo)
}

window.addEventListener("click", (e) => {
  const editModal = document.getElementById("editModal")
  const confirmModal = document.getElementById("confirmModal")
  const messageModal = document.getElementById("messageModal") // Added message modal

  if (e.target === editModal) {
    editModal.style.display = "none"
  }
  if (e.target === confirmModal) {
    confirmModal.style.display = "none"
  }
  if (e.target === messageModal) {
    // Close message modal on outside click
    messageModal.style.display = "none"
  }
})

window.deleteBooking = deleteBooking
window.editBooking = editBooking
window.unblockDates = unblockDates

document.getElementById("filterDate")?.addEventListener("change", (e) => {
  const filterDate = e.target.value
  const filterService = document.getElementById("filterService").value
  const filterStylist = document.getElementById("filterStylist").value
  loadBookings(filterDate, filterService, filterStylist)
})

document.getElementById("filterService")?.addEventListener("change", (e) => {
  const filterDate = document.getElementById("filterDate").value
  const filterService = e.target.value
  const filterStylist = document.getElementById("filterStylist").value
  loadBookings(filterDate, filterService, filterStylist)
})

document.getElementById("filterStylist")?.addEventListener("change", (e) => {
  const filterDate = document.getElementById("filterDate").value
  const filterService = document.getElementById("filterService").value
  const filterStylist = e.target.value
  loadBookings(filterDate, filterService, filterStylist)
})

async function loadMessages(filterStatus = "") {
  if (!database) {
    document.getElementById("messagesList").innerHTML =
      '<div class="empty-state">Firebase nie jest skonfigurowany</div>'
    return
  }

  const snapshot = await get(contactMessagesRef)
  const messagesList = document.getElementById("messagesList")

  if (!snapshot.exists()) {
    messagesList.innerHTML = '<div class="empty-state">Brak wiadomości do wyświetlenia</div>'
    return
  }

  const messagesData = snapshot.val()
  let messages = Object.keys(messagesData).map((key) => ({
    id: key,
    ...messagesData[key],
  }))

  // Filter messages
  if (filterStatus) {
    messages = messages.filter((m) => m.status === filterStatus)
  }

  // Sort by date (newest first)
  messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  if (messages.length === 0) {
    messagesList.innerHTML = '<div class="empty-state">Brak wiadomości do wyświetlenia</div>'
    return
  }

  messagesList.innerHTML = messages
    .map((message) => {
      const date = new Date(message.createdAt).toLocaleString("pl-PL")
      const preview = message.message.length > 100 ? message.message.substring(0, 100) + "..." : message.message

      return `
        <div class="message-card ${message.status}" onclick="viewMessage('${message.id}')">
            <div class="message-header">
                <span class="message-sender">${message.name}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-email">${message.email}</div>
            <div class="message-preview">${preview}</div>
            <span class="message-status ${message.status}">
                ${message.status === "unread" ? "Nieprzeczytane" : "Przeczytane"}
            </span>
        </div>
      `
    })
    .join("")
}

let currentMessageId = null

function viewMessage(id) {
  currentMessageId = id

  get(ref(database, `contactMessages/${id}`)).then((snapshot) => {
    if (!snapshot.exists()) return

    const message = snapshot.val()
    const date = new Date(message.createdAt).toLocaleString("pl-PL")

    document.getElementById("messageDetails").innerHTML = `
      <div class="detail-row">
        <div class="detail-label">Od:</div>
        <div class="detail-value">${message.name}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Email:</div>
        <div class="detail-value">${message.email}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Data:</div>
        <div class="detail-value">${date}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Wiadomość:</div>
        <div class="detail-value">${message.message}</div>
      </div>
    `

    document.getElementById("messageModal").style.display = "block"
  })
}

document.getElementById("closeMessageModal")?.addEventListener("click", () => {
  document.getElementById("messageModal").style.display = "none"
})

document.getElementById("markAsReadBtn")?.addEventListener("click", async () => {
  if (!currentMessageId) return

  try {
    await update(ref(database, `contactMessages/${currentMessageId}`), {
      status: "read",
    })

    document.getElementById("messageModal").style.display = "none"
    loadMessages()
  } catch (error) {
    console.error("[v0] Error marking message as read:", error)
    alert("Wystąpił błąd podczas oznaczania wiadomości")
  }
})

document.getElementById("deleteMessageBtn")?.addEventListener("click", async () => {
  if (!currentMessageId) return

  showConfirmModal("Czy na pewno chcesz usunąć tę wiadomość?", async () => {
    try {
      await remove(ref(database, `contactMessages/${currentMessageId}`))
      document.getElementById("messageModal").style.display = "none"
      loadMessages()
    } catch (error) {
      console.error("[v0] Error deleting message:", error)
      alert("Wystąpił błąd podczas usuwania wiadomości")
    }
  })
})

document.getElementById("filterMessageStatus")?.addEventListener("change", (e) => {
  loadMessages(e.target.value)
})

window.viewMessage = viewMessage
