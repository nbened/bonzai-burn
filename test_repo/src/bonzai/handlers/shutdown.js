function shutdownHandler(req, res) {
  console.log('🛑 Shutdown endpoint called - terminating server...');
  
  res.json({ 
    success: true, 
    message: 'Server shutting down...' 
  });
  
  // Close the server gracefully
  setTimeout(() => {
    process.exit(0);
  }, 100); // Small delay to ensure response is sent
}

module.exports = shutdownHandler;

