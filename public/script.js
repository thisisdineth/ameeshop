
// Initialize sidebar state
document.addEventListener('DOMContentLoaded', function() {
  // Sidebar toggle functionality
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const mobileOverlay = document.getElementById('mobile-overlay');
  
  // Desktop sidebar toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('sidebar-collapsed');
      
      // Update toggle icon
      const icon = this.querySelector('svg');
      if (sidebar.classList.contains('sidebar-collapsed')) {
        icon.innerHTML = '<path d="m9 18 6-6-6-6"/>';
      } else {
        icon.innerHTML = '<path d="m15 18-6-6 6-6"/>';
      }
    });
  }
  
  // Mobile sidebar toggle
  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('sidebar-mobile-open');
      mobileOverlay.classList.toggle('hidden');
      
      // Update mobile toggle icon
      const icon = this.querySelector('svg');
      if (sidebar.classList.contains('sidebar-mobile-open')) {
        icon.innerHTML = '<path d="m15 18-6-6 6-6"/>';
      } else {
        icon.innerHTML = '<path d="m9 18 6-6-6-6"/>';
      }
    });
  }
  
  // Close sidebar when clicking overlay
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', function() {
      sidebar.classList.remove('sidebar-mobile-open');
      mobileOverlay.classList.add('hidden');
      
      // Update mobile toggle icon if it exists
      if (mobileToggleBtn) {
        const icon = mobileToggleBtn.querySelector('svg');
        icon.innerHTML = '<path d="m9 18 6-6-6-6"/>';
      }
    });
  }

  // Set greeting based on time of day
  const greeting = document.getElementById('greeting');
  if (greeting) {
    const hour = new Date().getHours();
    if (hour < 12) {
      greeting.textContent = 'Good Morning, Administrator!';
    } else if (hour < 18) {
      greeting.textContent = 'Good Afternoon, Administrator!';
    } else {
      greeting.textContent = 'Good Evening, Administrator!';
    }
  }
});
