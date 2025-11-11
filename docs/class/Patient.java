import java.util.List;

public class Patient {
    private String id;
    private String patientCode;
    private String authId;
    private int loyaltyPoints;
    
    // Quan hệ nhiều-một
    private Auth auth;
    
    // Quan hệ một-nhiều
    private List<PatientProfile> patientProfiles;
    private List<DoctorRating> doctorRatings;
    
    public Patient() {
    }
}

