public class AppointmentService {
    private String appointmentId;
    private String serviceId;
    private String workSessionId;
    
    // Quan hệ nhiều-một
    private Appointment appointment;
    private Service service;
    private WorkSession workSession;
    
    public AppointmentService() {
    }
}

