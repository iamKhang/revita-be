import java.util.List;

public class Technician {
    private String id;
    private String technicianCode;
    private String authId;
    private boolean isActive;
    
    // Quan hệ nhiều-một
    private Auth auth;
    
    // Quan hệ một-nhiều
    private List<WorkSession> workSessions;
    private List<PrescriptionService> prescriptionServices;
    private List<Certificate> certificates;
    
    public Technician() {
    }
}

