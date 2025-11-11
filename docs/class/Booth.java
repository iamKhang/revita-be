import java.time.LocalDateTime;
import java.util.List;

public class Booth {
    private String id;
    private String boothCode;
    private String name;
    private String roomId;
    private String description;
    private boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private ClinicRoom room;
    
    // Quan hệ một-nhiều
    private List<WorkSession> workSessions;
    private List<BoothService> boothServices;
    private List<PrescriptionService> prescriptionServices;
    
    public Booth() {
    }
}

